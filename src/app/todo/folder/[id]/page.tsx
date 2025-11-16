// src/app/todo/folder/[id]/page.tsx

/**
 * FolderPage (動的ルート /todo/folder/[id])
 *
 * このファイルの役割
 * - URL パラメータのフォルダ ID（エンコード済み）を受け取り、
 *   そのフォルダに紐づく TODO 一覧を表示するページ。
 * - サーバーコンポーネントとしてフォルダのメタデータ（名前・説明）を Firestore から取得し、
 *   クライアントコンポーネント FolderTasks に実際の TODO の描画を任せる。
 *
 * 設計方針
 * - params は Next.js App Router 標準の `{ params: { id: string } }` で受け取る。
 *   Promise を経由させる必要はないため、シンプルな型にリファクタ。
 * - フォルダメタデータが存在しない場合も、ページ自体はクラッシュさせず
 *   「名前だけ表示」するフォールバックとする。
 *
 * 関連コンポーネント
 * - FolderTasks（src/app/components/FolderTasks.tsx）
 *   - 実際の plans コレクションから folder ごとの TODO を購読・表示する。
 */

import React from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import FolderTasks from "../../../components/FolderTasks";

// Next.js App Router の動的ルート用 props 型
type FolderPageProps = {
  params: { id: string };
};

export default async function FolderPage({ params }: FolderPageProps) {
  const folderId = params?.id;

  // 開発時のデバッグログ（本番ではログレベルを落としてもよい）
  console.log("FolderPage called. params:", params);

  if (!folderId) {
    return (
      <section style={{ padding: 16 }}>
        <h1>不正なフォルダID</h1>
        <p>URL を確認してください。</p>
      </section>
    );
  }

  // URL エンコードされた ID を元に戻す（フォルダ名そのものを URL に使っている前提）
  const decodedId = decodeURIComponent(folderId);

  // ---- フォルダメタデータの取得 ---------------------------------------------

  // デフォルト（folders コレクションにレコードが無い場合のフォールバック）
  let folderData: { name: string; description?: string } = {
    name: decodedId,
    description: "",
  };

  try {
    if (!db) throw new Error("Firestore `db` is undefined on server");

    const folderRef = doc(db, "folders", decodedId);
    const folderSnap = await getDoc(folderRef);

    if (folderSnap.exists()) {
      const data = folderSnap.data() as any;
      folderData = {
        name:
          typeof data.name === "string" && data.name.trim()
            ? data.name
            : decodedId,
        description:
          typeof data.description === "string" ? data.description : "",
      };
    } else {
      // folders コレクションにエントリがない場合は、plans 側の folder フィールドだけで運用しているケース。
      // ここでは単に decodedId をフォルダ名として表示する。
      console.warn("Folder not found for id:", decodedId);
    }
  } catch (err) {
    console.error("FolderPage: error fetching folder metadata:", err);
    // 失敗しても folderData はデフォルト値のままレンダリング（クラッシュを避ける）
  }

  // ---- ページ描画 -----------------------------------------------------------

  return (
    <section
      style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}
    >
      {/* フォルダヘッダ（名前と説明） */}
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>
          {folderData.name || "（名前不明）"}
        </h1>
        {folderData.description && (
          <p style={{ marginTop: 4, color: "#666" }}>
            {folderData.description}
          </p>
        )}
      </header>

      {/* TODO 一覧（クライアントコンポーネントに責務を委譲） */}
      <div id="folder-tasks-root">
        <FolderTasks folderId={decodedId} />
      </div>
    </section>
  );
}
