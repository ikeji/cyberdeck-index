# CYBERDECK インデックスサイト 設計 (v2)

元: https://scrapbox.io/CYBERDECK/ (公開プロジェクト、496ページ)

## 1. コンセプト

- Scrapbox の記事を **構造化データ (JSON) に正規化**し、それを元に Cloudflare Pages で閲覧できる **インデックスサイト**を作る。
- 位置づけ:
  - 本サイトは「**索引**」。各エントリの主役は **元記事へのリンク** (Reddit 投稿など)。
  - 画像は **キャッシュとして自前ホスト**する（元が消えても索引として成立させる）。
  - 本文の転載はしない。
  - 手書きのメモ・解説ページは JSON ではなく **Markdown の固定ページ** (`content/*.md`) として扱う。
- Scrapbox 記法の汎用 HTML 変換は**作らない**。ページを「エントリ」に抽出する方式にする。
- 読み取り専用。Scrapbox が正本、データはビルド時に毎回導出できる。

## 2. 実データの分析 (2026-10 時点)

| 種類 | 件数目安 | 構造 |
|---|---|---|
| Reddit 投稿クリップ | 約460 | タイトル / Gyazo画像(1〜数枚) / reddit URL |
| 外部記事の紹介 | 約30 | `scrapbox.io/files` 画像 / `[URL ラベル]` (cyberdeck.cafe, doscher.com, hackaday 等) |
| 手書きメモ・Wiki | 数十 | 箇条書きテキスト + 内部リンク (例: Raspberry Pi, SBC, 情報が集まってる場所) → **エントリ化しない** |

上2つは「画像 + 元記事URL」という同じ構造なので、**区別せず同一のエントリ型**とする（出どころは `source.site` で表す）。

- 画像URL形式: `https://gyazo.com/{id}` (651), `https://scrapbox.io/files/{id}.png` (約300), `https://preview.redd.it/...` (ごく少数)
- ハッシュタグはほぼ無い (`#IKeJIのおすすめ` 19件、`#日本の作例` 5件など)。タグは少数の運用タグ＋Scrapbox の内部リンク名で補う。
- ※ Scrapbox API は既定の Python urllib UA だと 403 になる。`User-Agent` を付与して取得する。

## 3. パイプライン

```
[Scrapbox API] --fetch--> data/raw/*.json        (生データ。gitignore、ローカルのみ)
                --extract--> data/entries/*.json  (正規化エントリ。★正本として git 管理)
                             content/notes/*.md   (メモ系ページ。初回のみ手動で移行、以降は手書き)
                --images--> data/images/**        (キャッシュ画像。git 管理 or §6参照)
                --build--> dist/                  (HTML, index.json, 検索index)
```

1. **fetch**: `GET /api/pages/CYBERDECK?limit=1000` で一覧 → `updated` が変化したページのみ `GET /api/pages/CYBERDECK/{title}` を取得 (UA必須、200ms間隔)。
2. **extract**: raw → Entry へ変換 (§5)。決定的で冪等。メモ系ページは Entry を作らずスキップ（§5.1）。
3. **images**: Entry の画像を未取得分だけダウンロード・変換 (§6)。
4. **build**: Entry から静的HTMLを生成。
- 各段は入出力がファイルなので、単体で再実行できる。

## 4. データスキーマ

### 4.1 ファイル

| ファイル | 内容 |
|---|---|
| `data/entries/{id}.json` | 1エントリ1ファイル (`id` = Scrapbox page id)。差分がレビューしやすい |
| `data/index.json` | build が生成する軽量一覧 (`entries` の主要フィールドのみ) |
| `data/tags.json` | build が生成するタグ → entry id 配列 |
| `schema/entry.schema.json` | JSON Schema (draft 2020-12)。CI で全 entry を検証 |

### 4.2 Entry

```jsonc
{
  "schemaVersion": 1,
  "id": "6aa4007db7b2c4f22e806265",       // Scrapbox page id（不変キー）
  "title": "Microcifra 26",
  "source": {                              // 元記事（必須）
    "url": "https://www.reddit.com/r/cyberDeck/comments/1vw4fda/microcifra_26/",
    "site": "reddit",                      // reddit | youtube | twitter | hackaday | github | web ...
    "label": null                          // [URL ラベル] 形式のときのラベル
  },
  "links": [                               // source 以外の外部リンク
    { "url": "https://cyberdeck.cafe/", "label": "cyberdeck.cafe", "site": "web" }
  ],
  "images": [
    {
      "id": "sha256:ab12…",                // 内容ハッシュ（重複排除キー）
      "origin": "https://gyazo.com/5974b42d5f594b365a1b75fb08ab4882",
      "originRaw": "https://gyazo.com/5974b42d5f594b365a1b75fb08ab4882/raw",
      "status": "ok",                      // ok | missing | error | pending
      "width": 1920, "height": 1080,
      "mime": "image/webp",
      "files": {
        "thumb": "img/ab/ab12….thumb.webp",   // 一覧用 ~480px
        "full":  "img/ab/ab12….webp"          // 詳細用 ~1600px
      },
      "fetchedAt": "2026-10-03T00:00:00Z"
    }
  ],
  "tags": ["IKeJIのおすすめ"],              // ハッシュタグ
  "related": ["Raspberry Pi", "SBC"],       // Scrapbox 内部リンク先タイトル (タグ候補)
  "comment": null,                          // 抽出できなかった残りのテキスト (プレーン)。無ければ null
  "scrapbox": {
    "url": "https://scrapbox.io/CYBERDECK/Microcifra%2026",
    "created": "2026-09-11T…Z",
    "updated": "2026-09-11T…Z",
    "views": 12,
    "thumbnail": "https://gyazo.com/5974…/raw"   // Scrapbox の image フィールド
  }
}
```

- 必須: `schemaVersion, id, title, source, images, tags, scrapbox`。
- `images[].origin` は元のURL。`files` はサイト相対パス（`BASE_URL` を付与して使う）。
- 画像が取得できないとき: `status:"missing"` とし `files` は省略。一度成功した画像は元が消えても**キャッシュを残す**（status は ok のまま）。
- 日付は ISO 8601 UTC（API の epoch 秒から変換）。
- 破壊的変更時は `schemaVersion` を上げ、extract で全再生成する。

### 4.3 エントリ / メモの振り分け

- **エントリ**: 外部 `source` を持つページ。
- **メモ**: `source` が無い、または本文の非URL行が多い (例: 3行以上) ページ。Entry にせず Markdown へ（§5.1）。
- `kind` は持たない。サイト上の絞り込みは `source.site`（reddit / youtube / web …）で行う。

## 5. extract ルール (raw → Entry)

行単位で判定し、1行は1つの役割に割り当てる。1行目はタイトル。

| 行の形 | 結果 |
|---|---|
| `[https://gyazo.com/ID]` | `images[]` (`origin`, `originRaw=…/raw`) |
| `[https://scrapbox.io/files/ID.png]`, 画像拡張子 URL, `preview.redd.it` | `images[]` |
| 裸URL / `[URL]` / `[URL ラベル]` (画像でない) | 最初の1件 → `source` (reddit を優先)、残り → `links[]` |
| `#タグ` | `tags[]` |
| `[ページ名]` (URLでない) | `related[]` (`tags` とは別) |
| 空行 | 無視 |
| 上記以外 | `comment` に連結（プレーンテキスト） |

- Gyazo の `/raw` が画像でなく動画/GIFの場合は Content-Type で判定し、`mime` に反映（初期版は静止画へのフォールバックのみ、動画は未対応でリンク扱い）。
- 同一ページ内の同一画像は重複排除。

### 5.1 メモ系ページ

- 振り分け（§4.3）でメモと判定されたページは、extract が `data/memo-candidates.txt` に **タイトル一覧を出力するだけ**（Entry は作らない）。
- 数十件程度なので、サイトに載せたいものだけ **手動で Markdown 化** して `content/notes/{slug}.md` に置く。以降は Markdown が正本（Scrapbox とは同期しない）。
- Markdown は frontmatter (`title`, `slug`, `order`) + 本文。`/about/` も同じ仕組み (`content/about.md`) で作る。
- 内部リンク `[ページ名]` は、Markdown 側で通常のリンクに書き換える。

## 6. 画像キャッシュ

- **取得**: `originRaw` を `User-Agent` 付きで GET。リダイレクト追従、タイムアウト・リトライ(3回)。同時接続は少数に制限。
- **変換** (sharp): 全画像から `thumb` (長辺480px) と `full` (長辺1600px、拡大しない) を **WebP** で生成。元ファイルは保存しない（容量節約）。
  - GIF: 初期版はアニメを保持せず1フレーム目で WebP 化。アニメが必要になれば `animated` を追加。
- **保存**: `data/images/{hash[0:2]}/{hash}.webp` / `.thumb.webp`。ハッシュ = 元画像バイト列の SHA-256。内容アドレスなので重複は自動的に排除され、キャッシュの無効化も不要。
- **差分**: Entry の `images[].files` が存在しファイルも在るものは再取得しない。
- **容量見積**: 約950枚 × (full ~250KB + thumb ~25KB) ≒ **約260MB**。実測は約113MB（957枚）。Cloudflare Pages の制限（1サイト2万ファイル・1ファイル25MiB）と GitHub リポジトリの推奨サイズ(1GB)の範囲内。
- **保存場所の選択肢**:
  - A (推奨): 画像も git で管理。シンプルで確実。
  - B: 画像だけ別リポジトリ or `images` ブランチに分離（履歴肥大の回避）。
  - C: キャッシュ機構（Actions キャッシュ等）のみ → **不可**（消えるため、キャッシュの正本として不適）。
- **配信**: `dist/img/` に配置し、同一オリジンで配信。`loading="lazy"` / `width,height` 属性でレイアウトシフト防止。

## 7. サイト

```
/                      一覧: サムネイルのカードグリッド（更新順）+ site/タグで絞り込み
/e/{id}/               エントリ詳細
/tags/{tag}/           タグ別一覧
/search/               クライアントサイド検索
/notes/{slug}/         メモ (content/notes/*.md)
/about/                本サイトの位置づけ・出典・削除依頼窓口 (content/about.md)
```

- **一覧カード**: thumb 1枚、タイトル、`site` バッジ（reddit 等）、画像枚数。クリックで詳細。
- **詳細ページ**: 画像ギャラリー（full）、**「元記事を見る →」ボタン (`source.url`, `rel="noopener noreferrer"`)**、`links`、`tags`、`related`（該当エントリがあればサイト内リンク）、「Scrapbox で見る」リンク。`comment` があればプレーンテキストで表示。
- URL は `id` ベース (`/e/{id}/`) で、日本語/記号タイトルの問題を回避。タイトルは表示のみ。
- **検索**: ビルド時に `search-index.json` (title, tags, source.site, comment, メモの本文) を生成 → MiniSearch。日本語は bigram。
- **OGP**: `og:image` に thumb、`og:title`、`og:url`。
- 見た目はレスポンシブ + ダーク (`prefers-color-scheme`)。

## 8. 実装構成

```
cyberdeck/
├─ DESIGN.md
├─ package.json            # Node.js (ESM)。依存: sharp, ajv, minisearch
├─ schema/entry.schema.json
├─ scripts/
│  ├─ fetch.mjs            # §3-1
│  ├─ extract.mjs          # §5
│  ├─ images.mjs           # §6
│  ├─ validate.mjs         # ajv で全 entry を検証
│  └─ build.mjs            # §7 の HTML/検索index 生成
├─ templates/  static/
├─ content/{about.md, notes/*.md}   # 手書き Markdown
├─ data/{raw(ignored), entries, images}
├─ dist/ (ignored)
└─ .node-version
```

- 静的サイトジェネレータは使わず `build.mjs` で直接生成。Markdown 変換は `marked` 等を使う。
- `extract.mjs` は純粋関数 (`rawPage -> Entry`) として切り出し、実データ496件で スナップショットテスト。

## 9. 更新とデプロイ

- **データ更新は手作業**（ローカル）。`npm run fetch && npm run extract && npm run images && npm run validate` の後、`data/` を commit / push する。定期実行はしない。新規登録は §9.1 のツールを使う。
- **公開は Cloudflare Pages**（git 連携）。`main` への push で自動ビルド・デプロイされる。GitHub Actions は使わない。
  - Build command: `npm ci && npm test && npm run validate && npm run build` / output: `dist` / Node: `.node-version` (22)。
  - `validate` が失敗するとビルドが失敗し、公開中のサイトは維持される。
  - ビルド時に Scrapbox や Gyazo へはアクセスしない（コミット済みの `data/` のみ使用）。
  - `dist/_headers` で `/img/*` を immutable キャッシュ（ファイル名が内容ハッシュのため）。
- 配信はルート直下 (`/`)。`BASE_URL` の既定は `/`（サブパス配信時のみ指定）。`SITE_URL` は OGP 用の任意設定。
- Gyazo は短時間の大量取得で 503 を返すため、`images` は低速（2並列・500ms間隔）で動き、失敗分は次回実行で再試行する。

## 9.1 登録ツール（Scrapbox 移行後の入力経路）

- Scrapbox は移行元。移行後は `data/entries/` が正本で、`fetch`/`extract` は使わない（使っても手動追加分は消えない）。
- **ブックマークレット + ローカルサーバ** (`scripts/add-server.mjs`, `tools/bookmarklet.js`, `tools/add.html`):
  - ブックマークレットがログイン済みブラウザ上でタイトル/URL/画像URLを収集（Reddit は同一オリジンの `.json` を使い、ギャラリーも取得。YouTube はサムネイル、X は `pbs.twimg.com/media`、その他は `og:*`）。
  - 通信せず `http://localhost:8787/add#<base64url(JSON)>` を新規タブで開く（Reddit 等の CSP を回避）。
  - 確認画面で編集（画像の取捨選択、URL追加、ファイルアップロード）→ `POST /api/add` → サーバが画像をキャッシュして Entry を書く。
  - 安全対策: 127.0.0.1 のみ待受、Host 検証（DNS rebinding 対策）、POST は `Origin` 検証 + `application/json` 必須（CSRF 対策）。
- 共通ロジックは `scripts/add-lib.mjs`（URL 正規化・重複判定・Entry 生成）。CLI `npm run add` も同じ関数を使う。
- スキーマ: `scrapbox` は任意、`addedAt` を追加。ID は正規化した source URL の SHA-1 先頭24桁。アップロード画像の `origin` は `local:<sha256>`。

## 10. 注意点・リスク

- **権利**: 画像のキャッシュは第三者の投稿画像の複製に当たる。`/about/` に「索引サイト・画像は元投稿のキャッシュ・権利は元の投稿者に帰属・削除依頼窓口」を明記。依頼があれば該当エントリの `images` を削除できるよう、`data/takedown.json`（id一覧）で除外できる仕組みを入れる。可能なら CYBERDECK 運営者へも確認する。
- **画像消失**: Gyazo/Reddit 側の消失は `status` で検知。キャッシュ済みは維持。
- **API 変更/レート**: 差分取得＋待機で負荷を抑える。
- **Scrapbox 側の手動編集**: 抽出ルールに合わない行は `comment` に残るので、データ欠落はしない。メモ判定のページは候補一覧に出る。

## 11. 実装ステップ

1. `fetch.mjs` + 全件取得（UA付き）。
2. `schema/entry.schema.json` と `extract.mjs`。全496件で変換し、エントリ数・メモ候補（除外）・`comment` が出るページを目視確認。
3. `images.mjs`（約950枚、実容量を測定して §6 の A/B を確定）。
4. `build.mjs`（一覧・詳細・タグ・Markdownページ）→ 検索 → `/about/`。
5. Cloudflare Pages に接続して公開。

## 12. 未決事項

- 公開URL（`*.pages.dev` のプロジェクト名 / 独自ドメインの有無）
- 画像の保存場所: A(git管理) で良いか（実測後に再確認）
- メモ系ページのうち Markdown 化して載せるもの（全部／一部／無し）
- 見た目の方向性（Scrapbox 風 or 独自ダーク）
- 運営者への事前確認、takedown 窓口（メール/GitHub Issues）
