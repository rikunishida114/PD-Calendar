// src/app/todo/folder/[id]/page.tsx
/**
 * FolderPage
 * -------------------------------------------------------------
 * 役割:
 *  - URL `/todo/folder/[id]` ごとのフォルダページを表示する Server Component。
 *  - 上部にフォルダ名 / 説明を表示し、下部にそのフォルダに属する TODO 一覧を表示する。
 *
 * 設計方針:
 *  - URL パラメータの id は `encodeURIComponent(folderName)` されたものを受け取り、
 *    ここで `decodeURIComponent` して「実際のフォルダ名」として扱う。
 *  - フォルダのメタデータ（正式名称や説明文）が `folders` コレクションにあればそれを表示、
 *    なければ「フォルダ名 = decodedId」の簡易表示にフォールバックする。
 *  - TODO 一覧の表示は Client Component `FolderTasks` に責務を分離する。
 *
 * 関連コンポーネント:
 *  - `src/app/components/FolderSidebar.tsx`
 *      → 各フォルダへのリンクを表示するサイドバー。
 *         `encodeURIComponent(name)` した文字列を `/todo/folder/:id` に渡す。
 *  - `src/app/components/FolderTasks.tsx`
 *      → 実際の TODO 一覧を描画する Client Component。
 */

import React from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import FolderTasks from "@/app/components/FolderTasks";

// ★ 今の Next.js の挙動に合わせて、params は Promise<{ id: string }> として受ける
type FolderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function FolderPage({ params }: FolderPageProps) {
  // ------------------------------------------------------------
  // ① params は Promise なので、必ず await してから id を取り出す
  //    （ここを await しないと、エラーメッセージのように怒られる）
  // ------------------------------------------------------------
  const resolvedParams = await params;
  const rawId = resolvedParams.id; // 例: "%E8%AB%96%E6%96%87%E7%B4%B9%E4%BB%8B"

  // 本来は常に存在する想定だが、念のため防御的にチェック
  if (!rawId) {
    return (
      <section style={{ padding: 16 }}>
        <h1>不正なフォルダID</h1>
        <p>URL を確認してください。</p>
      </section>
    );
  }

  // ------------------------------------------------------------
  // ② URL エンコードされた ID を実際のフォルダ名に戻す
  // ------------------------------------------------------------
  const decodedId = decodeURIComponent(rawId); // 例: "（未分類）" や "論文紹介"

  // フォルダメタデータの初期値（folders コレクションが空でも動くようにする）
  let folderData: { name: string; description?: string } = {
    name: decodedId,
    description: "",
  };

  // ------------------------------------------------------------
  // ③ Firestore からフォルダのメタデータを取得（あれば上書き）
  // ------------------------------------------------------------
  try {
    if (!db) {
      throw new Error("Firestore `db` is undefined on server");
    }

    // folders コレクションに「フォルダの説明」を保存しておく設計
    const folderRef = doc(db, "folders", decodedId);
    const folderSnap = await getDoc(folderRef);

    if (folderSnap.exists()) {
      const data = folderSnap.data() as any;
      folderData = {
        name:
          typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : decodedId,
        description:
          typeof data.description === "string" ? data.description : "",
      };
    } else {
      // folders コレクションにエントリがない場合:
      // - ログだけ出して、画面表示は decodedId ベースの簡易表示にフォールバック
      console.warn("Folder not found for id in `folders` collection:", decodedId);
    }
  } catch (err) {
    // Firestore 読み込みに失敗しても画面ごと落とさない
    console.error("FolderPage: error fetching folder metadata:", err);
  }

  // ------------------------------------------------------------
  // ④ レンダリング
  //    上部: フォルダ名 + 説明
  //    下部: FolderTasks (Client Component) に decodedId を渡して TODO 一覧を表示
  // ------------------------------------------------------------
  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      {/* ヘッダー: フォルダ名と説明 */}
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{folderData.name || "（名前不明）"}</h1>
        {folderData.description && (
          <p style={{ marginTop: 4, color: "#666" }}>{folderData.description}</p>
        )}
      </header>

      {/* TODO 一覧: Client Component に責務を委譲 */}
      <div id="folder-tasks-root">
        {/* FolderTasks 側では:
            - folderId === "（未分類）" を特別扱い
            - それ以外は where("folder", "==", folderId) で Firestore 購読 */}
        <FolderTasks folderId={decodedId} />
      </div>
    </section>
  );
}
