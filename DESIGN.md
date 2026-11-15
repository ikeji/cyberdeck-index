# CYBERDECK インデックスサイト 設計

## 1. コンセプト

- サイバーデックの作例・関連記事を **構造化データ (JSON)** として管理し、Cloudflare Pages で閲覧できる **インデックスサイト**を生成する。
- 位置づけ:
  - 本サイトは「**索引**」。各エントリの主役は **元記事へのリンク** (Reddit 投稿、YouTube、個人ブログなど)。
  - 画像は **キャッシュとして自前ホスト**する（元が消えても索引として成立させる）。
  - 本文の転載はしない。
  - 手書きの解説・案内ページは JSON ではなく **Markdown の固定ページ** (`content/*.md`) として扱う。
- `data/entries/*.json` と `data/images/**` を正本として git 管理する（初期データは Scrapbox プロジェクト `CYBERDECK` から移行済み）。

## 2. パイプライン

```
[Bookmarklet / CLI] --add / add-server--> data/entries/*.json  (正規化エントリ。正本として git 管理)
                                          data/images/**       (キャッシュ画像。git 管理)
[content/*.md]      -------------------->                      (手書き Markdown 固定ページ)
                    --images----------->  data/images/**       (未取得・失敗画像の再取得)
                    --validate--------->  (JSON Schema 検証)
                    --build------------>  dist/                (HTML, rss.xml, sitemap.xml, search-index.json)
```

1. **add / add-server**: ブックマークレットまたは CLI から新規エントリを登録し、画像をダウンロード・WebP 変換して保存する（§4）。
2. **images**: Entry のうち未取得 (`pending`) や失敗 (`error`) の画像をダウンロード・変換する（§5）。
3. **validate**: `schema/entry.schema.json` で全 Entry を検証する。
4. **build**: Entry と Markdown から静的 HTML・RSS・サイトマップ・検索インデックスを生成する（§6）。
- 各段は入出力がファイルなので、単体で再実行できる。

## 3. データスキーマ

### 3.1 ファイル

| ファイル | 内容 |
|---|---|
| `data/entries/{id}.json` | 1エントリ1ファイル（24桁 hex ID）。差分がレビューしやすい |
| `data/takedown.json` | 掲載を取り下げるエントリ `id` の配列 |
| `schema/entry.schema.json` | JSON Schema (draft 2020-12)。ビルド前に全 entry を検証 |

### 3.2 Entry

```jsonc
{
  "schemaVersion": 1,
  "id": "10e29fb4fb5c27c201e19317",       // 正規化 source.url の SHA-1 先頭24桁（移行分は旧 page id）
  "title": "Microcifra 26",
  "source": {                              // 元記事（必須）
    "url": "https://www.reddit.com/r/cyberDeck/comments/1vw4fda/microcifra_26/",
    "site": "reddit",                      // reddit | youtube | twitter | hackaday | github | instagram | web
    "label": null                          // リンクラベル（任意）
  },
  "links": [                               // source 以外の外部リンク
    { "url": "https://cyberdeck.cafe/", "label": "cyberdeck.cafe", "site": "web" }
  ],
  "images": [
    {
      "id": "sha256:ab12…",                // 内容ハッシュ（重複排除キー）
      "origin": "https://preview.redd.it/…",
      "originRaw": "https://preview.redd.it/…",
      "status": "ok",                      // ok | missing | error | pending
      "width": 1600, "height": 1200,
      "mime": "image/webp",
      "files": {
        "thumb": "img/ab/ab12….thumb.webp",   // 一覧用 ~480px
        "full":  "img/ab/ab12….webp"          // 詳細用 ~1600px
      },
      "fetchedAt": "2026-11-13T00:00:00.000Z"
    }
  ],
  "tags": ["Handheld"],                    // タグ
  "related": [],                           // 関連エントリタイトル
  "comment": null,                         // 補足メモ（プレーンテキスト）。無ければ null
  "addedAt": "2026-11-13T00:00:00.000Z"    // 登録日時 (ISO 8601 UTC)
}
```

- 必須: `schemaVersion, id, title, source, images, tags`。
- Scrapbox からの移行エントリは `addedAt` の代わりに任意の `scrapbox` オブジェクト (`url, created, updated, views, thumbnail`) を保持しており、ソート順・RSS 日時のフォールバックおよび詳細ページの参考リンクに使われる。
- `images[].origin` は元の URL（ファイルアップロード時は `local:<sha256>`）。`files` はサイト相対パス（`BASE_URL` を付与して使う）。
- 画像が取得できないとき: `status: "missing"` とし `files` は省略。一度成功した画像は元が消えても**キャッシュを残す**（`status` は `ok` のまま）。

## 4. 登録ツール

- **ブックマークレット + ローカルサーバ** (`scripts/add-server.mjs`, `tools/bookmarklet.js`, `tools/add.html`):
  - ブックマークレットがログイン済みブラウザ上でタイトル / URL / 画像 URL を収集（Reddit は同一オリジンの `.json` を使いギャラリーも取得。YouTube はサムネイル、X は `pbs.twimg.com/media`、その他は `og:*`）。
  - 通信せず `http://localhost:8787/add#<base64url(JSON)>` を新規タブで開く（Reddit 等の CSP を回避）。
  - 確認画面で編集（画像の取捨選択、URL 追加、ファイルアップロード）→ `POST /api/add` → サーバが画像をキャッシュして Entry を書く。
  - 安全対策: `127.0.0.1` のみ待受、`Host` 検証（DNS rebinding 対策）、POST は `Origin` 検証 + `application/json` 必須（CSRF 対策）。
- **CLI** (`scripts/add.mjs`):
  - `npm run add -- <url> [--title T] [--tag x] [--comment C] [--image <URL|file>]`
  - YouTube（oEmbed + サムネイル）や一般サイト（OGP / `<title>`）はメタ情報を自動取得。
- 共通ロジックは `scripts/add-lib.mjs`（URL 正規化・重複判定・Entry 生成・更新）。同じ `source.url` が既にあれば画像・タグを追記更新する。

## 5. 画像キャッシュ

- **取得**: `originRaw` を `User-Agent` 付きで GET（Gyazo ページ URL は `/raw` に正規化、YouTube の `maxresdefault` 不在時は `hqdefault` にフォールバック）。リダイレクト追従、タイムアウト・リトライあり。
- **変換** (`sharp`): 全画像から `thumb` (長辺 480px) と `full` (長辺 1600px、拡大しない) を **WebP** で生成。元ファイルは保存しない（容量節約）。
- **保存**: `data/images/{hash[0:2]}/{hash}.webp` / `.thumb.webp`。ハッシュ = 元画像バイト列の SHA-256。内容アドレスなので重複は自動的に排除され、キャッシュの無効化も不要。
- **再試行**: `npm run images` は `pending` / `error` の画像のみ低速（2並列・500ms間隔）で取得する（`--retry-missing` で `missing` も対象）。
- **配信**: `dist/img/` に配置し、同一オリジンで配信。`loading="lazy"` / `width, height` 属性でレイアウトシフトを防止する。

## 6. サイト構成

```
/                      一覧: サムネイルのカードグリッド（新着・更新順）+ site / タイトルで絞り込み
/e/{id}/               エントリ詳細
/tags/                 タグ一覧
/tags/{tag}/           タグ別一覧
/search/               クライアントサイド検索 (MiniSearch)
/notes/{slug}/         手書きノート (content/notes/*.md があるときのみ生成)
/about/                本サイトの位置づけ・権利表記・削除依頼窓口 (content/about.md)
/rss.xml               新着エントリの RSS 2.0 フィード
/sitemap.xml           サイトマップ
/robots.txt            クローラ向け設定
```

- **一覧カード**: `thumb` 1枚、タイトル、`site` バッジ（Reddit 等）、画像枚数。クリックで詳細。
- **詳細ページ**: 画像ギャラリー（`full`）、**「View original →」ボタン (`source.url`, `rel="noopener noreferrer"`)**、`tags`、`related`（該当エントリがあればサイト内リンク）、`links`、`comment`（プレーンテキスト）、移行元 `scrapbox` リンク（存在する場合のみ）。
- **検索**: ビルド時に `search-index.json` (`title`, `tags`, `related`, `comment`, `source.label`, `source.site`, ノートの本文) を生成し、MiniSearch でクライアントサイド検索を行う。
- **OGP**: `og:image` に `thumb`、`og:title`、`og:url`、canonical URL を出力。
- 見た目はレスポンシブ + ダーク対応 (`prefers-color-scheme`)。

## 7. ディレクトリ構成

```
cyberdeck/
├─ DESIGN.md
├─ README.md
├─ package.json            # Node.js (ESM)。依存: sharp, ajv, marked, minisearch
├─ .node-version           # Node 22
├─ schema/entry.schema.json
├─ scripts/
│  ├─ common.mjs           # パス定数・リトライ付き HTTP 取得
│  ├─ add-lib.mjs          # エントリ登録・URL 正規化・メタ取得
│  ├─ add.mjs              # CLI 登録ツール
│  ├─ add-server.mjs       # ブックマークレット用ローカルサーバ
│  ├─ images-lib.mjs       # 画像取得・WebP 変換・SHA-256 保存
│  ├─ images.mjs           # 未取得・失敗画像の一括再取得
│  ├─ validate.mjs         # ajv で全 entry を検証
│  ├─ rss-lib.mjs          # RSS 2.0 XML 生成
│  └─ build.mjs            # HTML / RSS / sitemap / 検索 index 生成
├─ tools/
│  ├─ bookmarklet.js       # ブラウザ上で投稿情報を収集するスクリプト
│  └─ add.html             # 登録確認・編集 UI
├─ templates/layout.mjs
├─ static/{style.css, filter.js, search.js}
├─ content/{about.md, notes/*.md}
├─ data/{entries, images, takedown.json}
└─ dist/ (gitignored)
```

## 8. デプロイと運用

- **データ更新は手作業**（ローカル）。`add-server` または `add` で登録し、`npm run validate` で検証後、`data/` を commit / push する。
- **公開は Cloudflare Pages**（git 連携）。`main` への push で自動ビルド・デプロイされる。
  - Build command: `npm ci && npm test && npm run validate && npm run build` / output: `dist` / Node: `.node-version` (22)。
  - `validate` や `test` が失敗するとビルドが失敗し、公開中のサイトは維持される。
  - ビルド時に外部サイトへはアクセスしない（コミット済みの `data/` のみ使用）。
  - `dist/_headers` で `/img/*` を immutable キャッシュ（ファイル名が内容ハッシュのため）。
- 配信はルート直下 (`/`)。`BASE_URL` の既定は `/`（サブパス配信時のみ指定）。`SITE_URL` は canonical / OGP / RSS / sitemap 用の任意設定（既定は `https://cyberdeck-index.pages.dev`）。

## 9. 注意点・リスク

- **権利**: 画像のキャッシュは第三者の投稿画像の複製に当たる。`/about/` に「索引サイト・画像は元投稿のキャッシュ・権利は元の投稿者に帰属・削除依頼窓口（GitHub Issues）」を明記している。依頼があれば `data/takedown.json` に該当エントリの `id` を追加して公開対象から除外するか、該当画像を削除する。
- **画像消失**: 元サイト側の画像消失は取得時に `status: "missing"` として記録する。一度キャッシュ済みの画像は維持する。
