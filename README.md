# Zen Sudoku — 完全広告なし・スマホ最適化PWAナンプレ（数独）

スマートフォンのブラウザおよびPWA（ホーム画面への追加・オフライン動作）に最適化した、広告ゼロのモダンなナンプレ（数独）Webアプリケーションです。

---

## 主な特徴

1. **完全広告なし・オフライン完結（PWA対応）**
   - `manifest.webmanifest` とキャッシュ戦略を備えた Service Worker (`public/sw.js`) を搭載。
   - iOS Safari / Android Chrome の「ホーム画面に追加」からネイティブアプリのように全画面（Standalone）で起動し、機内モード等のオフライン環境でもそのまま遊べます。
2. **スマホ特化の1画面完結レイアウト (`100dvh`)**
   - 画面高 `100dvh` 内にヘッダー・盤面・操作ツールバー・1〜9テンキーを収め、プレイ中の不要な縦スクロールやダブルタップ拡大（`touch-action: manipulation`）を完全に防止しています。
3. **唯一解保証の高速パズル生成エンジン（Web Worker対応）**
   - Easy（初級）/ Medium（中級）/ Hard（上級）/ Expert（達人）の4段階。
   - MRVヒューリスティック付きバックトラッキング検証により、**必ず解が1つだけ（唯一解）**であることを保証します。Web Worker上で非同期生成するため、スマホのUIスレッドをブロックしません。
4. **充実の操作・アシスト機能**
   - **通常入力 / メモ入力（候補数字）** のワンタップ切替
   - **マス先（Cell-First）** と **数字先（Number-First 連続入力）** の2つの入力モード切替
   - **自動メモ消去**（数字確定時、同じ行・列・3×3ブロック内の同一候補メモを自動削除、設定でON/OFF可能）
   - **Undo / Redo（無制限の履歴管理）** と **消去（消しゴム）**
   - **視認性アシスト**: 選択マスの行・列・3×3ブロックのハイライト、同じ数字の一括強調、9個配置完了した数字のテンキー完了チェック＆減光表示
   - **リアルタイム自動保存**: `localStorage` に盤面・メモ・経過時間・履歴をリアルタイム保存し、リロードやアプリ再起動時も即座に中断箇所から再開可能
   - **ダークモード / ライトモード**: OS連動（自動）・ライト・ダークのワンタップ切替

---

## ディレクトリ構成

```text
.
├── index.html                  # エントリHTML（モバイルビューポート・PWAメタタグ設定済）
├── package.json                # 依存パッケージ・スクリプト定義
├── postcss.config.js           # PostCSS設定
├── tailwind.config.js          # Tailwind CSS設定（ダークモード・アニメーション定義）
├── tsconfig.json               # TypeScript設定
├── vercel.json                 # Vercelゼロコンフィグデプロイ設定
├── vite.config.ts              # Viteビルド設定
├── public/
│   ├── manifest.webmanifest    # PWA Web App Manifest
│   ├── sw.js                   # オフライン対応 Service Worker
│   └── icons/                  # PWA用アプリアイコン一式 (192px, 512px, maskable, Apple Touch Icon, SVG)
└── src/
    ├── main.tsx                # Reactマウント & Service Worker登録
    ├── index.css               # Tailwind読込 & 100dvh / touch-action 制御
    ├── App.tsx                 # メインUI・状態管理・キーボード/タッチ操作
    ├── types/
    │   └── sudoku.ts           # 型定義
    └── utils/
        ├── sudokuEngine.ts     # 唯一解保証ナンプレ生成・ソルバー・盤面検証ロジック
        ├── puzzleWorkerClient.ts # 非同期Web Worker生成クライアント
        └── storage.ts          # localStorage 自動保存・統計管理・Haptics振動制御
```

---

## ローカル環境での起動手順

Node.js (v18以上推奨) がインストールされた環境で、プロジェクトルートにて以下のコマンドを実行してください。

```bash
# 1. 依存パッケージのインストール
npm install

# 2. 開発サーバーの起動 (http://localhost:5173)
npm run dev
```

本番用ビルドおよびローカルでの動作確認（Service Workerの動作確認含む）を行う場合：

```bash
# 本番ビルド (`dist/` ディレクトリに出力されます)
npm run build

# ビルド成果物のローカルプレビュー
npm run preview
```

---

## Vercelへのデプロイ手順

本プロジェクトはルート直下に `package.json`, `vite.config.ts`, `vercel.json` を配置しているため、設定変更なしでそのままデプロイ可能です。

### 方法A: GitHubリポジトリ連携（推奨）
1. このZIPファイルを解凍し、中身を新しく作成したGitHubリポジトリのルートへPushします。
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Zen Sudoku PWA"
   git branch -M main
   git remote add origin https://github.com/<あなたのユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```
2. [Vercel](https://vercel.com/) にログインし、**「Add New...」→「Project」** を選択します。
3. 先ほどPushしたGitHubリポジトリを **Import** します。
4. Framework Preset が自動的に **Vite** として認識されます（Build Command: `npm run build`, Output Directory: `dist`）。そのまま **「Deploy」** をクリックすれば数十秒で公開完了です。

### 方法B: Vercel CLI からの直接デプロイ
```bash
npx vercel
```
