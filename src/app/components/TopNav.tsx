// components/TopNav.tsx
"use client";

/**
 * TopNav.tsx
 * - ページ上部中央に「Todo」「Calendar」ボタンを配置するシンプルなナビゲーション。
 * - App Router を使うため next/link を用いたクライアント側のリンク。
 * - 毎ページで共通して使えるように、app/layout.tsx に入れるか、各 page に import して配置してください。
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation"; // 現在パスの判定（選択中スタイル用）

export default function TopNav() {
  const pathname = usePathname(); // 例: "/todo" "/calendar"
  return (
    <header style={{
      width: "100%",
      padding: "12px 0",
      display: "flex",
      justifyContent: "center",
      boxSizing: "border-box",
      borderBottom: "1px solid #eee",
      background: "#fff",
      position: "sticky",
      top: 0,
      zIndex: 50
    }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/todo" style={{
          padding: "8px 16px",
          borderRadius: 6,
          textDecoration: "none",
          background: pathname === "/todo" ? "#1f6feb" : "#f4f6fb",
          color: pathname === "/todo" ? "#fff" : "#333",
          boxShadow: pathname === "/todo" ? "0 4px 10px rgba(31,111,235,0.15)" : "none"
        }}>
          Todo
        </Link>

        <Link href="/calendar" style={{
          padding: "8px 16px",
          borderRadius: 6,
          textDecoration: "none",
          background: pathname === "/calendar" ? "#1f6feb" : "#f4f6fb",
          color: pathname === "/calendar" ? "#fff" : "#333",
          boxShadow: pathname === "/calendar" ? "0 4px 10px rgba(31,111,235,0.15)" : "none"
        }}>
          Calendar
        </Link>
      </nav>
    </header>
  );
}
