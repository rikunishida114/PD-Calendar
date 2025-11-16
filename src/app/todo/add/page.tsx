// src/app/todo/add/page.tsx
"use client";

/**
 * AddTodoPage.tsx
 *
 * このファイルの役割
 * - 「TODOを追加」ページのコンテナ。
 * - 実際のフォーム本体（AddTodoForm）は client component として動的 import し、
 *   サーバーサイドレンダリング（SSR）を無効化している。
 *
 * 設計方針
 * - AddTodoForm は useState や useEffect などクライアント専用のロジックを多く含むため、
 *   dynamic import + { ssr: false } でクライアントレンダリング限定にしている。
 *
 * 関連コンポーネント
 * - AddTodoForm（src/app/components/AddTodoForm）
 * - AddFab（右下の＋ボタン）からこのページに遷移する。
 */

import dynamic from "next/dynamic";
import React from "react";

// AddTodoForm は client-only コンポーネントなので、dynamic import で SSR を無効化
const AddTodoForm = dynamic(
  () => import("../../../app/components/AddTodoForm"),
  { ssr: false }
);

export default function AddTodoPage() {
  return (
    <section
      style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}
    >
      <h2>TODOを追加</h2>
      <p>
        単一タスク・複数タスク（目的＋タスク群）に加えて、
        AI を使ってタスク案を生成することもできます。
      </p>

      <AddTodoForm />
    </section>
  );
}
