// src/app/layout.tsx

/**
 * RootLayout.tsx
 *
 * このファイルの役割
 * - アプリ全体の HTML スケルトンと共通レイアウトを定義する。
 * - 上部に TopNav（Todo / Calendar のナビゲーション）、
 *   下に各ページ固有のコンテンツ（children）を描画する。
 *
 * 設計方針
 * - App Router のルートレイアウトとして、全ページ共通の UI（ナビバーなど）をここに集約する。
 * - main 部分のスタイルは各ページ側に任せるため、ここでは構造だけを定義。
 *
 * 関連コンポーネント
 * - TopNav（src/app/components/TopNav）
 * - 各 page.tsx（/todo, /calendar など）
 */

import "./globals.css";
import TopNav from "./components/TopNav";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {/* アプリ共通のトップナビゲーション */}
        <TopNav />
        {/* 各ルートのコンテンツ */}
        <main>{children}</main>
      </body>
    </html>
  );
}
