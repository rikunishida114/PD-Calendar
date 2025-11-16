// app/todo/add/page.tsx
"use client";
import dynamic from "next/dynamic";
import React from "react";

const AddTodoForm = dynamic(
  () => import("../../../app/components/AddTodoForm"),
  { ssr: false }
);

export default function AddTodoPage() {
  return (
    <section style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <h2>TODOを追加</h2>
      <p>
        単一タスク・複数タスク（目的＋タスク群）に加えて、
        AI を使ってタスク案を生成することもできます。
      </p>

      <AddTodoForm />
    </section>
  );
}
