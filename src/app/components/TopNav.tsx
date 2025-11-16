// src/app/components/TopNav.tsx
"use client";

/**
 * TopNav.tsx
 *
 * このファイルの役割
 * - アプリ全体の上部に表示するシンプルなナビゲーションバー。
 * - 「Todo」「Calendar」へのナビゲーションボタンを表示し、現在のページをハイライトする。
 *
 * 設計方針
 * - App Router の Link と usePathname を利用して、クライアント側遷移と選択中スタイルを実現。
 * - `layout.tsx` から一度だけ読み込んで全ページ共通にする想定（各 page では重複して import しない）。
 *
 * 関連コンポーネント
 * - RootLayout（app/layout.tsx）で <TopNav /> を配置している。
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation"; // 現在パスの取得（アクティブ判定用）

export default function TopNav() {
  // 例: "/todo" "/calendar"
  const pathname = usePathname();

  // 共通スタイル生成ヘルパー（アクティブ時と非アクティブ時で色を切り替える）
  const linkStyle = (href: string): React.CSSProperties => {
    const isActive = pathname === href;
    return {
      padding: "8px 16px",
      borderRadius: 6,
      textDecoration: "none",
      background: isActive ? "#1f6feb" : "#f4f6fb",
      color: isActive ? "#fff" : "#333",
      boxShadow: isActive ? "0 4px 10px rgba(31,111,235,0.15)" : "none",
    };
  };

  return (
    <header
      style={{
        width: "100%",
        padding: "12px 0",
        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 中央にシンプルなタブ風ナビゲーション */}
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/todo" style={linkStyle("/todo")}>
          Todo
        </Link>
        <Link href="/calendar" style={linkStyle("/calendar")}>
          Calendar
        </Link>
      </nav>
    </header>
  );
}
