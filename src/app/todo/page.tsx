// src/app/todo/page.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

// components は src/app/components に置いてある前提 -> todo/page から見て ../components
const TodoList = dynamic(() => import("../components/TodoList"), { ssr: false });
const FolderSidebar = dynamic(() => import("../components/FolderSidebar"), { ssr: false });

// 日表示（DayView）と AddFab は通常 import でOK（いずれも client component）
import DayView from "../components/DayView";
import AddFab from "../components/AddFab";

/**
 * TodoPage (merged)
 * - DayView を上部に表示
 * - 直近の TODO (TodoList)
 * - サイドバー (FolderSidebar)
 * - 右下の追加ボタン (AddFab)
 *
 * 注意: TopNav は既に layout.tsx に含めている場合はここに入れないでください（重複するため）。
 */

export default function TodoPage() {
  return (
    <>
      <main
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          minHeight: "calc(100vh - 64px)", // ヘッダ高さがあるなら調整
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 5 }}>
          {/* 日表示（上部） */}
          <DayView />

          {/* 直近の TODO */}
          <section style={{ marginTop: 16 }}>
            <h2>TODO</h2>
            <TodoList />
          </section>
        </div>

        {/* 右: サイドバー */}
        <aside style={{ flex: "0 0 220px" }}>
          <FolderSidebar />
        </aside>

        {/* + ボタン（固定） */}
        <AddFab />
      </main>
    </>
  );
}
