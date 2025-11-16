// src/app/page.tsx

/**
 * Root Page (/)
 *
 * このファイルの役割
 * - アプリのルートパス "/" にアクセスされたときに、
 *   メイン画面である "/todo" へリダイレクトするだけの薄いエントリポイント。
 *
 * 設計方針
 * - ルートに独自コンテンツを持たせず、/todo を事実上のトップページとして扱う。
 * - App Router の redirect を使うことで、SSR 時点でリダイレクトを完了させる。
 *
 * 関連ルート
 * - /todo（TodoPage）
 */

import { redirect } from "next/navigation";

export default function Page() {
  // ルートアクセス時に /todo にリダイレクト
  redirect("/todo");
}
