# Zen Sudoku — 広告なし・スマホ向けナンプレ（数独）

**遊ぶ: https://shigeta117.github.io/sudoku-pwa/**

広告なし・登録なしで遊べるナンプレ（数独）の Web アプリです。スマートフォンのブラウザで開き、「ホーム画面に追加」するとアプリのように全画面で起動し、オフラインでも遊べます（PWA）。

## 特徴

- **解き方の難しさで分けた 5 段階の難易度**
  ヒントの数ではなく、解くのに必要な一番難しい解き方で難易度を決めています。どの問題も解は 1 つだけで、勘で埋める必要はありません。

  | 難易度 | 必要な解き方 |
  |---|---|
  | 初級 | シングルだけ |
  | 中級 | ブロックと行・列の関係（ポインティング）まで |
  | 上級 | ペア・トリプル・X-Wing まで |
  | 達人 | Y-Wing などウイング系まで |
  | 鬼 | チェーン系（XY-Chain・AIC） |

- **解き方を教えるヒント**：次に決まるマスを枠で示し、使う解き方の名前（「隠れたシングル」「X-Wing」など）を表示します。もう一度押すと答えの数字が出ます。間違った数字があれば先にそれを知らせます。
- **入力**：通常入力とメモ（候補数字）、マス先と数字先（同じ数字を続けて置く）の切り替え、自動メモ消去、無制限に近い戻す／進む（直近 300 手）、消しゴム。
- **見やすさ**：選んだマスの行・列・ブロック、同じ数字、間違い（オフにもできる）を色で示します。9 個置き終えた数字はテンキーで薄くなります。
- **自動保存**：盤面・メモ・時間・履歴を端末内（localStorage）に保存し、閉じても続きから再開できます。データはどこにも送信しません。
- **ダークモード**：OS に合わせる／ライト／ダーク。

キーボード：`1`〜`9` 入力、`0`/`Backspace` 消去、`N` メモ切替、`H` ヒント、矢印で移動、`Ctrl+Z`/`Ctrl+Shift+Z` 戻す／進む。

## 開発

Node.js 20 以上。

```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm test         # テスト（Vitest）
npm run build    # dist/ に本番ビルド
npm run preview  # ビルド結果の確認（Service Worker の動作もここで確認）
```

`main` に push すると GitHub Actions がテスト・ビルドして GitHub Pages に公開します（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）。`vite.config.ts` の `base` は相対パス（`./`）なので、Vercel などのドメイン直下にもそのまま置けます。

### 構成

```text
src/
├── App.tsx                     画面・状態管理・キーボード操作
├── sw.js                       オフライン用 Service Worker の雛形（ビルド時に版と配布ファイルを埋め込んで dist/sw.js に出力）
├── types/sudoku.ts             型と難易度の一覧
└── utils/
    ├── sudokuEngine.ts         難易度の定義・問題生成（sudoku-core）・盤面の判定
    ├── puzzle.worker.ts        問題生成を UI と別スレッドで動かす Web Worker
    ├── puzzleWorkerClient.ts   Worker の呼び出しと、次の 1 問の先読み
    ├── hint.ts                 ヒントの計算と解き方の日本語名
    ├── history.ts              戻す／進むの履歴（上限つき）
    └── storage.ts              保存データの読み書きと検証・統計・振動
public/
├── manifest.webmanifest        PWA の設定
└── third-party-licenses.txt    同梱している依存パッケージのライセンス
```

## クレジット

問題の生成・難易度の判定・ヒントには [sudoku-core](https://github.com/komeilmehranfar/sudoku-core)（MIT, © Komeil Mehranfar）を使っています。同梱している依存パッケージのライセンス全文は [public/third-party-licenses.txt](public/third-party-licenses.txt) にあります。

## ライセンス

[MIT](LICENSE)
