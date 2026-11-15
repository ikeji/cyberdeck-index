# CYBERDECK Index

サイバーデックの作例・関連記事のリンク集サイト（Cloudflare Pages で公開）。
設計は [DESIGN.md](DESIGN.md) を参照。

```
npm ci
npm run add-server # ブックマークレット用の登録サーバを起動 (127.0.0.1:8787)
npm run add -- ... # CLI からエントリを登録
npm run images     # 未取得・失敗分の画像を再取得して data/images に WebP でキャッシュ
npm run validate   # entries を schema/entry.schema.json で検証
npm run build      # dist/ を生成 (BASE_URL の既定は /)
npm test
```

## 新しいエントリを登録する（ブックマークレット）

`data/entries/` と `data/images/` が正本（git 管理）。新規登録は次のとおり。

```
npm run add-server     # http://localhost:8787/ で待ち受け (127.0.0.1 のみ)
```

1. http://localhost:8787/ を開き、「+ Add to CYBERDECK」リンクをブックマークバーにドラッグ。
2. Reddit / YouTube / X / 一般サイトの投稿ページでそのブックマークを押す → 確認画面が開く。
3. タイトル・タグ・画像を整えて「Save」→ 画像を取得・WebP 化して `data/entries/*.json` を作成（同じ URL なら更新）。
4. `npm run validate && npm run build` で確認、`git add data && git commit && git push` で公開。

CLI でも登録できる: `npm run add -- <url> [--title T] [--tag x] [--comment C] [--image <URL|ファイル>]`
(YouTube・一般サイトはタイトル/画像を自動取得。Reddit・X は自動取得不可なのでブックマークレットか `--title/--image` を使う)

## データ管理・運用

- データの登録・画像キャッシュは手元で実行する（CI では取得しない）。公開時のビルドはコミット済みの `data/` のみを使い、外部サイトへはアクセスしない。
- 登録時に取得失敗した画像 (`status: error` / `pending`) は `npm run images` で再試行できる（`--retry-missing` で `missing` も再試行）。
- `content/about.md`, `content/notes/*.md` は手書き Markdown の固定ページ。
- 掲載を取り下げるエントリの id は `data/takedown.json` に追加する。

## 公開 (Cloudflare Pages)

GitHub リポジトリを Cloudflare Pages に接続する (Workers & Pages → Create → Pages → Connect to Git)。

| 項目 | 値 |
|---|---|
| Production branch | `main` |
| Build command | `npm ci && npm test && npm run validate && npm run build` |
| Build output directory | `dist` |
| 環境変数 `SITE_URL` (任意) | 既定は `https://cyberdeck-index.pages.dev` (rss.xml / sitemap.xml / canonical / OGP 画像用。別ドメインで公開する場合のみ指定) |

- Node のバージョンは `.node-version` (22) で指定済み。
- 以降は `git push` するだけで自動デプロイされる。`dist/_headers` で画像 (`/img/*`) に長期キャッシュを付与している。
- ルート直下 (`/`) で配信されるので `BASE_URL` の指定は不要。サブパスで公開する場合のみ `BASE_URL=/path/` を設定する。
