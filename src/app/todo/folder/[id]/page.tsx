// src/app/todo/folder/[id]/page.tsx
import React from "react";
import { db } from "@/lib/firebase"; // 必要に応じてパスを調整
import { doc, getDoc } from "firebase/firestore";

// FolderTasks は client component（src/app/components/FolderTasks.tsx）
// page.tsx が Server Component のままでも client component を import して使えます。
import FolderTasks from "../../../components/FolderTasks"; // <-- フォルダ位置に合わせて修正してください

type Props = { params: Promise<{ id?: string }> | { id?: string } };

// Server Component (async) - params を await してから使う
export default async function FolderPage({ params }: Props) {
  // params が Promise の場合に備えて await する
  const resolvedParams = await params;
  // デバッグ（開発時のみ）
  console.log("FolderPage called. resolvedParams:", resolvedParams);

  const folderId = resolvedParams?.id;
  console.log("folderId:", folderId);

  if (!folderId) {
    return (
      <section style={{ padding: 16 }}>
        <h1>不正なフォルダID</h1>
        <p>URL を確認してください。</p>
      </section>
    );
  }

  // URL エンコードを戻す
  const decodedId = decodeURIComponent(folderId);

  // folder metadata を取得（あれば folders コレクションから、なければフォールバックでデフォルト表示）
  let folderData: any = { name: decodedId, description: "" };
  try {
    if (!db) throw new Error("Firestore `db` is undefined on server");
    const folderRef = doc(db, "folders", decodedId);
    const folderSnap = await getDoc(folderRef);
    if (folderSnap.exists()) {
      folderData = folderSnap.data();
    } else {
      // folders コレクションにエントリがない場合は plans 側の集計などのフォールバックを行う
      // （ここでは簡易に既定値のままにしている）
      console.warn("Folder not found for id:", decodedId);
    }
  } catch (err) {
    console.error("FolderPage: error fetching folder metadata:", err);
    // folderData は既定値のままレンダリング（クラッシュ防止）
  }

  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{folderData?.name ?? "（名前不明）"}</h1>
        {folderData?.description && <p style={{ marginTop: 4, color: "#666" }}>{folderData.description}</p>}
      </header>

      {/* Client component に decodedId を渡して描画 */}
      <div id="folder-tasks-root">
        <FolderTasks folderId={decodedId} />
      </div>
    </section>
  );
}
