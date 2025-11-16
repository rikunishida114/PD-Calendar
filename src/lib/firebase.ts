// lib/firebase.ts
// Firebase アプリと Firestore インスタンスを初期化し、singleton としてエクスポートするモジュール。
//
// 役割:
// - initializeApp() を「アプリ全体で 1 回だけ」呼び出し、複数初期化エラーを防ぐ。
// - Firestore 用の db インスタンスを提供し、各コンポーネントから共通利用できるようにする。
// - 環境変数から Firebase 設定値を読み込む（NEXT_PUBLIC_* はクライアント側バンドルにも含まれることに注意）。
//
// 設計方針:
// - `getApps()` / `getApp()` を用いて singleton パターンを実現。
//   → Next.js のようにモジュールが複数回評価されうる環境でも安全に動作させるため。
// - 秘密情報（サービスアカウントキーなど）はここでは扱わず、必要な場合は別途サーバー専用環境変数で管理する。
// - Firestore は `db` としてエクスポートし、`import { db } from "@/lib/firebase";` という形で利用する。
//
// 関連コンポーネント:
// - plans コレクションへアクセスする全てのコンポーネント
//   (AddTodoForm, DayView, TodoList, FolderSidebar, FolderTasks, TodoDetailModal など)
// - taskPatterns コレクションにアクセスする TaskIdeasPanel など。

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --------------------------------------------------
// Firebase 設定値 (クライアント側でも必要な情報だけ NEXT_PUBLIC_* で公開)
// - ここで扱っている値は「プロジェクト識別子」であり、シークレットではない前提。
// - 実際の秘密鍵や管理用認証情報はサーバー側の別設定に置くべき。
// --------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --------------------------------------------------
// Firebase App の singleton 初期化
// - getApps() が空配列 → まだ初期化されていないので initializeApp()
// - それ以外 → すでにどこかで初期化済みなので getApp() で再利用
// - Next.js の開発モードではホットリロードなどでモジュールが複数回評価されるため、
//   このパターンにしておかないと「Firebase App named '[DEFAULT]' already exists」が発生する。
// --------------------------------------------------
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --------------------------------------------------
// Firestore インスタンスの作成とエクスポート
// - 以降、`import { db } from "@/lib/firebase";` で Firestore にアクセスできる。
// - app 単体が欲しい場合は default export の app を利用。
// --------------------------------------------------
export const db = getFirestore(app);
export default app;
