# CYBERDECK Index

Scrapbox プロジェクト [CYBERDECK](https://scrapbox.io/CYBERDECK/) のサイバーデックの作例のリンク集サイト（Cloudflare Pages で公開）。
設計は [DESIGN.md](DESIGN.md) を参照。

```
npm ci
npm run fetch      # Scrapbox API -> data/raw (差分取得, gitignore。移行用)
npm run extract    # data/raw -> data/entries/*.json (移行用。手動追加分 = scrapbox なし は消さない)
npm run images     # 画像を取得して data/images に WebP でキャッシュ (再実行で続きから)
npm run validate   # entries を schema/entry.schema.json で検証
npm run build      # dist/ を生成 (BASE_URL の既定は /)
npm test
```

## 新しいエントリを登録する（ブックマークレット）

Scrapbox からの移行後は `data/entries/` が正本。新規登録は次のとおり。

```
npm run add-server     # http://localhost:8787/ で待ち受け (127.0.0.1 のみ)
```

1. http://localhost:8787/ を開き、「+ CYBERDECK に登録」リンクをブックマークバーにドラッグ。
2. Reddit / YouTube / X / 一般サイトの投稿ページでそのブックマークを押す → 確認画面が開く。
3. タイトル・タグ・画像を整えて「登録」→ 画像を取得・WebP 化して `data/entries/*.json` を作成（同じ URL なら更新）。
4. `npm run build` で確認、`git add data && git commit && git push` で公開。

CLI でも登録できる: `npm run add -- <url> [--title T] [--tag x] [--comment C] [--image <URL|ファイル>]`
(YouTube・一般サイトはタイトル/画像を自動取得。Reddit・X は自動取得不可なのでブックマークレットか `--title/--image` を使う)

## 更新手順（手作業）

データの取得・画像キャッシュは手元で実行する（CI は使わない）。

```
npm run fetch && npm run extract   # Scrapbox の更新を取り込む
npm run images                     # 新規画像をキャッシュ (Gyazo の 503 が出たら時間を置いて再実行)
npm run validate
git add data && git commit && git push   # push すると Cloudflare Pages が自動でビルド・公開
```

- 公開は Cloudflare Pages（下記）。コミット済みの `data/` からビルドするだけで、Scrapbox や Gyazo にはアクセスしない。

- `data/entries/` と `data/images/` が正本（git 管理）。
- `content/about.md`, `content/notes/*.md` は手書き Markdown。メモ候補は `data/memo-candidates.txt` を参照。
- 掲載を取り下げるエントリの id は `data/takedown.json` に追加する。
- Gyazo は短時間に大量取得すると 503 を返すため、`images` は低速で動く。失敗分 (`status: error`) は次回実行で再試行される。

## 公開 (Cloudflare Pages)

GitHub リポジトリを Cloudflare Pages に接続する (Workers & Pages → Create → Pages → Connect to Git)。

| 項目 | 値 |
|---|---|
| Production branch | `main` |
| Build command | `npm ci && npm test && npm run validate && npm run build` |
| Build output directory | `dist` |
| 環境変数 `SITE_URL` (任意) | 公開URL 例 `https://cyberdeck.pages.dev` (OGP 画像を絶対URLにする) |

- Node のバージョンは `.node-version` (22) で指定済み。
- 以降は `git push` するだけで自動デプロイされる。`dist/_headers` で画像 (`/img/*`) に長期キャッシュを付与している。
- ルート直下 (`/`) で配信されるので `BASE_URL` の指定は不要。サブパスで公開する場合のみ `BASE_URL=/path/` を設定する。
