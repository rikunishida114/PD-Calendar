"use client";

/**
 * src/app/components/AddFab.tsx
 * このファイルの役割
 * - 画面右下に常時表示される「＋」のフローティングボタン（Floating Action Button; FAB）。
 * - クリック時に /todo/add へクライアントサイド遷移する。
 *
 * 設計方針
 * - 役割は「UI + 遷移」のみとし、状態は「二重押下防止の loading フラグ」に限定する。
 * - 画面右下に重ねて表示したいだけなので、スタイルは inline-style で自己完結させている。
 *   （Tailwind や CSS Modules を導入する場合はその時点で移行すればよい）
 * - アクセシビリティのため aria-label を付与し、アイコンボタンでも意味が伝わるようにする。
 *
 * 関連コンポーネント / ページ
 * - /todo/add ページ
 *   - 実際に Todo を追加するフォームのページ。
 *   - ここに遷移していく導線としてこの FAB を使う。
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddFab() {
  // ---- ルーターと状態 --------------------------------------------------------

  // Next.js App Router のクライアントサイド遷移用フック
  const router = useRouter();

  /**
   * loading:
   * - ボタン連打による二重遷移を防ぐためのフラグ。
   * - true の間は disabled + カーソルを wait にしてユーザーに分かりやすくしている。
   */
  const [loading, setLoading] = useState(false);

  // ---- イベントハンドラ ------------------------------------------------------

  /**
   * FAB クリック時の処理
   * - already loading の場合は何もしない（多重処理防止）。
   * - router.push("/todo/add") でクライアントサイド遷移。
   * - ここでは遷移後に何かする予定がないため、push のあとの処理は特に書いていない。
   */
  const handleClick = async () => {
    if (loading) return; // 既に遷移中なら無視

    try {
      setLoading(true);
      await router.push("/todo/add");
      // push 自体は Promise を返すが、遷移後の後処理がなければここで終わり。
    } catch (err) {
      // 遷移に失敗した場合は、後でトースト表示などに差し替えやすいように console に出しておく。
      console.error("遷移に失敗しました:", err);
      setLoading(false);
    }
  };

  // ---- レンダリング ---------------------------------------------------------

  return (
    // 固定表示のため position: fixed を使用。
    // zIndex を高めにして、モーダルや他コンポーネントに埋もれないようにしている。
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label="Todoを追加"
      style={{
        position: "fixed",
        right: 20, // 画面右からの余白
        bottom: 20, // 画面下からの余白
        width: 64,
        height: 64,
        borderRadius: "50%", // 円形ボタン
        background: "#1f6feb", // 目立つ青色（GitHub ボタン風）
        color: "white",
        fontSize: 28,
        border: "none",
        boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      {/* loading 中は簡易的に「…」を表示（アイコンを変えたい場合はここを差し替える） */}
      {loading ? "…" : "+"}
    </button>
  );
}
