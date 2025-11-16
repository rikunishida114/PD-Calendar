// src/app/todo/page.tsx
"use client";

/**
 * TodoPage.tsx
 *
 * このファイルの役割
 * - アプリのメインとなる「TODO 管理」画面。
 * - 左側に DayView（1日のTODO）、その下に TodoList（直近のTODO）、
 *   右側に FolderSidebar（フォルダ別集計）を表示し、
 *   右下に AddFab（TODO追加ボタン）を常時表示する。
 *
 * 設計方針
 * - レイアウト自体は client component として実装し、各子コンポーネントも client component を前提とする。
 * - Firestore やブラウザ操作のロジックは子コンポーネントに閉じ込め、
 *   このコンポーネントは「画面レイアウトの組み立て」に責務を絞る。
 *
 * 関連コンポーネント
 * - DayView（src/app/components/DayView）
 * - TodoList（src/app/components/TodoList）
 * - FolderSidebar（src/app/components/FolderSidebar）
 * - AddFab（src/app/components/AddFab）
 */

import React from "react";
import dynamic from "next/dynamic";

// 動的 import: Firestore 購読などクライアント専用ロジックを持つコンポーネントは ssr: false にする
const TodoList = dynamic(
  () => import("../components/TodoList"),
  { ssr: false }
);
const FolderSidebar = dynamic(
  () => import("../components/FolderSidebar"),
  { ssr: false }
);

// DayView / AddFab も client component だが、ここでは通常 import でそのまま使う
import DayView from "../components/DayView";
import AddFab from "../components/AddFab";

export default function TodoPage() {
  return (
    <>
      <main
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          minHeight: "calc(100vh - 64px)", // 上部ナビゲーション分を差し引いた高さのイメージ
          boxSizing: "border-box",
        }}
      >
        {/* 左カラム：DayView + 直近の TODO */}
        <div style={{ flex: 5 }}>
          {/* 日別 TODO ビュー */}
          <DayView />

          {/* 直近の TODO 一覧 */}
          <section style={{ marginTop: 16 }}>
            <h2>TODO</h2>
            <TodoList />
          </section>
        </div>

        {/* 右カラム：フォルダサイドバー */}
        <aside style={{ flex: "0 0 220px" }}>
          <FolderSidebar />
        </aside>

        {/* 右下固定の「＋」ボタン（新規追加） */}
        <AddFab />
      </main>
    </>
  );
}
