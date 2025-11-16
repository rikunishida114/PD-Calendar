"use client";

/**
 * AddFab.tsx
 * 画面右下に常時表示される「＋」ボタン（Floating Action Button）。
 * - クリックで /todo/add に遷移（Next.js App Router の useRouter を使用）
 * - 二重クリック防止のため loading 状態を持つ
 * - アクセシビリティ（aria-label）を付与
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddFab() {
  // Next.js のクライアント向けルーター
  const router = useRouter();

  // ボタンのローディング状態（二重押下防止）
  const [loading, setLoading] = useState(false);

  // ボタンクリック時の処理
  const handleClick = async () => {
    if (loading) return; // 既に遷移中なら無視

    try {
      setLoading(true);
      // 遷移先がある前提（/todo/add を作っておくか、別のパスに変える）
      // router.push はクライアント側遷移を行います
      await router.push("/todo/add");
      // push は Promise を返します（遷移後の処理は不要ならここで終わり）
    } catch (err) {
      // エラーがあれば適切にログ or トースト表示する（今回は console）
      console.error("遷移に失敗しました:", err);
      setLoading(false);
    }
  };

  return (
    // 固定表示のため position: fixed を使用。zIndex を高めにして重なりを回避。
    <button
      // 見た目は丸く、大きめにして押しやすくする
      onClick={handleClick}
      disabled={loading}
      aria-label="Todoを追加"
      // style を直接書いているが、プロジェクトで CSS/ Tailwind を使うならそちらへ移行可能
      style={{
        position: "fixed",
        right: 20,              // 画面右からの余白
        bottom: 20,             // 画面下からの余白
        width: 64,
        height: 64,
        borderRadius: "50%",    // 丸ボタン
        background: "#1f6feb",  // 見やすい色（必要なら変更）
        color: "white",
        fontSize: 28,
        border: "none",
        boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,           // 他要素より前面に出す
      }}
    >
      {/* loading 時は回転アイコンや… を出しても良い（簡易的に「＋」→「…」で表示） */}
      {loading ? "…" : "+"}
    </button>
  );
}
