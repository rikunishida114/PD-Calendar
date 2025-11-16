# PD-Calendar（目的分解カレンダー）

## 概要

PD-Calendar は、カレンダー管理・フォルダ管理・AIタスク分解を統合した  
個人向けタスク管理ツールです。

特徴的なのは、ユーザーが作成した「目的＋タスク群」の履歴を学習し、  
自分自身の思考に最適化されたタスク分割テンプレートが自動で育っていく点です。

シンプルな UI で毎日のタスクを管理しつつ、  
使えば使うほど「自分に合ったタスク提案」が得られることを目指して設計しています。

---

## 画面イメージ・デモ

> 画像や動画は `docs/` ディレクトリなどに配置し、パスを差し替えてください。

### トップ（今日のタスク＋フォルダ＋追加ボタン）
![Home](./docs/home.png)

### カレンダー画面
![Calendar](./docs/calendar.png)

### 目的＋複数タスク追加フォーム
![Multi Task Form](./docs/multi-task.png)

### AIタスク提案パネル（TaskIdeasPanel）
![AI Panel](./docs/ai-panel.png)

### 動作デモ動画（任意）

- 全体の流れ（例）：  
  https://example.com/demo

- AI提案 → 複数タスクフォームに流し込む様子（例）：  
  https://example.com/demo-ai

---

## コアコンセプト

### 1. 「目的＋タスク群」の履歴を学習し、個人最適化されたテンプレートに育てる

複数タスク追加時に、以下の情報を `taskPatterns` コレクションとして保存します。

- 目的（例: 「修士論文の関連研究をまとめる」）
- その目的のために分解したタスク群（タイトル・日付・想定時間など）

次回以降、ユーザーが類似した目的を入力すると、  
過去のパターンとの類似度を計算して、もっとも近いパターンからタスク群を候補として生成します。

これにより、利用を重ねるほど以下のような「自分の癖」がテンプレートとして蓄積されます。

- どのような粒度でタスクを分解するか
- どんな順番で作業を進めるか
- よく使うタスク名・言い回し
- 目的ごとの典型的なタスク構造

アプリはこれを「自分専用のタスク分解辞書」として再利用します。

---

### 2. ローカル辞書優先＋不足時のみ LLM を呼ぶハイブリッド構成

タスク提案時の基本方針は以下です。

1. まず Firestore 上の `taskPatterns` から類似目的のパターンを検索  
2. 類似度が一定しきい値を下回る場合のみ、OpenAI API を使ってタスク候補を生成

これにより、

- データが蓄積されるほどローカルだけで完結しやすくなる
- LLM の利用回数とコストを抑えられる
- 個人の履歴に適応したタスク提案が可能になる

という性質を持つ設計になっています。

---

### 3. 共通タスクスキーマによる UI 全体の一貫性

すべてのタスクは共通スキーマで Firestore 上に保存されます（例：`title`, `date`, `folder`, `estimatedMin`, `done` など）。

このスキーマを前提とすることで、以下の異なるビュー間でデータを一貫して扱えるようにしています。

- 日付に紐づく「DayView」
- 月カレンダー
- フォルダ別タスク一覧
- 直近タスクリスト
- 詳細編集モーダル
- シングルタスク追加フォーム
- 目的＋複数タスク追加フォーム

また、フォーム内では `estimatedMin` を `number | ""` に統一し、  
Firestore 書き込み時に `number` / `null` に正規化することで、  
型の揺れを防ぎつつフォーム入力のしやすさも確保しています。

---

## ディレクトリ構成（抜粋）

```
src
├── app
│   ├── api
│   │   └── task-ideas
│   │       └── route.ts
│   ├── calendar
│   │   └── page.tsx
│   ├── components
│   │   ├── AddFab.tsx
│   │   ├── AddTodoForm.tsx
│   │   ├── addTodoTypes.ts
│   │   ├── DayView.tsx
│   │   ├── FolderSidebar.tsx
│   │   ├── FolderTasks.tsx
│   │   ├── MultiTaskForm.tsx
│   │   ├── SingleTaskForm.tsx
│   │   ├── TaskIdeasPanel.tsx
│   │   ├── TodoDetailModal.tsx
│   │   ├── TodoList.tsx
│   │   └── TopNav.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── todo
│       ├── add
│       │   └── page.tsx
│       ├── folder
│       │   └── [id]
│       │       └── page.tsx
│       └── page.tsx
└── lib
    └── firebase.ts
```
## セットアップ
1. 依存関係のインストール
```bash
npm install
# または
yarn install
```

2. Firebase プロジェクトの準備
Firestore を有効化し、以下のようなコレクションを利用します（例）

- plans（タスク本体）
- taskPatterns（目的＋タスク群の履歴）
- folders（フォルダメタ情報・任意）

3. 環境変数の設定（.env.local）

プロジェクトルートに .env.local を作成し、必要な環境変数を定義します。
```bash
# OpenAI API キー（クライアント側には絶対に出さない）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Firebase 関連（NEXT_PUBLIC_ を付けてクライアント側でも利用）
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxxxxxxxxxxxxxxx
```
4. 開発サーバー起動
```bash
npm run dev
# http://localhost:3000 にアクセス
```
## 今後の拡張案
- タスク履歴に基づく最適な実行順の提案
- 実際の作業時間ログとの比較による見積もり精度の自動補正
- スマートフォン向け UI の最適化（レスポンシブレイアウトの強化）
- リマインダー通知・ポモドーロタイマー連携
- 学習したパターンの可視化（どのようなタスク分解が多いかをグラフ表示）
- ローカル辞書のみで動作する「完全オフラインモード」への発展

