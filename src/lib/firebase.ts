// lib/firebase.ts
// Firebase(app) を singleton で初期化して、Firestore (db) をエクスポートする。
// 理由：複数回 initializeApp を呼ぶとエラーになるため、getApps()/getApp() で対処する。

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- ここを .env.local で設定する ---
// NEXT_PUBLIC_ で始まる環境変数はクライアントバンドルにも含まれます。
// 秘密情報（サービスアカウントなど）はサーバー側に置くこと。
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 既に初期化済みなら既存の app を使う。未初期化なら initializeApp。
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestore のインスタンスをエクスポート
export const db = getFirestore(app);
export default app;
