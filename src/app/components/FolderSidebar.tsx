// src/app/components/FolderSidebar.tsx
"use client";

/**
 * FolderSidebar.tsx
 *
 * このファイルの役割
 * - Todo を「folder」単位でグルーピングしたサマリーのサイドバーを表示する。
 *   - フォルダ名
 *   - total: タスク総数
 *   - done : 完了数
 *   - 完了率 (%)
 * - 折りたたみ（collapsed）状態を持ち、横幅をコンパクトにできる。
 *
 * 設計方針
 * - Firestore の plans コレクションを購読し、クライアント側で folder ごとに集計する。
 *   - 特別扱いとして、folder が空 or 未設定のものは「（未分類）」にまとめる。
 * - UI は「フォルダ一覧」と「完了状況の簡易表示」のみに責務を絞る。
 *   - フォルダの中身（タスク一覧）は FolderTasks 等に委ねる。
 *
 * 関連コンポーネント / ページ
 * - FolderTasks.tsx
 *   - /todo/folder/[folderId] の中で、このサイドバーと組み合わせて使う想定。
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ---- 型定義 -------------------------------------------------------------------

/**
 * 1フォルダ分の集計情報
 * - id   : URL 用の識別子（name を encodeURIComponent したもの）
 * - name : 画面上に表示するフォルダ名（例: "研究 / 授業"）
 */
type FolderInfo = {
  id: string;
  name: string;
  total: number;
  done: number;
};

// ---- メインコンポーネント ----------------------------------------------------

export default function FolderSidebar() {
  // Firestore から集計したフォルダ一覧
  const [folders, setFolders] = useState<FolderInfo[]>([]);

  // サイドバーの折りたたみ状態
  const [collapsed, setCollapsed] = useState(false);

  // 集計中かどうか
  const [loading, setLoading] = useState(true);

  // ---- Firestore 購読 --------------------------------------------------------

  useEffect(() => {
    // createdAt 降順で plans を全件購読
    const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        // フォルダ名ごとの集計用 Map
        const map = new Map<string, { total: number; done: number }>();

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data() as any;

          // folder が string で存在し、trim した結果が非空ならその名前、
          // そうでなければ「（未分類）」として扱う。
          const folderName: string =
            d.folder && typeof d.folder === "string" && d.folder.trim()
              ? d.folder.trim()
              : "（未分類）";

          const doneFlag: boolean = !!d.done;

          if (!map.has(folderName)) {
            map.set(folderName, { total: 0, done: 0 });
          }
          const cur = map.get(folderName)!;
          cur.total += 1;
          if (doneFlag) cur.done += 1;
        });

        // Map を配列に変換して状態にセット
        const arr: FolderInfo[] = Array.from(map.entries()).map(([name, v]) => ({
          id: encodeURIComponent(name), // URL safe id（動的ルートで decodeURIComponent する想定）
          name,
          total: v.total,
          done: v.done,
        }));

        setFolders(arr);
        setLoading(false);
      },
      (err) => {
        console.error("FolderSidebar onSnapshot error:", err);
        setLoading(false);
      }
    );

    // アンマウント時に購読解除
    return () => unsubscribe();
  }, []);

  // ---- ヘルパー：完了率計算 --------------------------------------------------

  /**
   * 指定フォルダの完了率を 0〜100 の整数として返す。
   * - total が 0 の場合は 0% として扱う。
   */
  const percent = (f: FolderInfo) => {
    if (f.total === 0) return 0;
    return Math.round((f.done / f.total) * 100);
  };

  // ---- レンダリング ---------------------------------------------------------

  return (
    <aside
      style={{
        width: collapsed ? 40 : 220,
        borderLeft: "1px solid #eee",
        padding: collapsed ? 8 : 12,
        transition: "width 0.2s ease",
        background: "#fafafa",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* 折りたたみトグルボタン */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "拡大" : "折りたたみ"}
          style={{
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .15s",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ▶
        </button>
      </div>

      {/* 折りたたみ時は縦書きラベルだけ表示 */}
      {collapsed ? (
        <div
          style={{
            writingMode: "vertical-rl",
            textAlign: "center",
            fontSize: 12,
          }}
        >
          Folders
        </div>
      ) : (
        <>
          <h4 style={{ margin: "0 0 8px 0" }}>フォルダ</h4>

          {loading && <div>集計中…</div>}

          {/* フォルダ一覧 */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {folders.map((f) => (
              <li
                key={f.id}
                style={{
                  padding: "8px 6px",
                  borderRadius: 6,
                  marginBottom: 6,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>
                    {/* Link を使って App Router の動的ルートへ遷移 */}
                    <Link
                      href={`/todo/folder/${f.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {f.name}
                    </Link>
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {f.done}/{f.total} 完了
                  </div>
                </div>
                <div style={{ width: 64, textAlign: "right", fontSize: 12 }}>
                  <strong>{percent(f)}%</strong>
                </div>
              </li>
            ))}

            {/* フォルダが1件もない場合の表示 */}
            {folders.length === 0 && !loading && (
              <li style={{ color: "#666" }}>フォルダがありません</li>
            )}
          </ul>
        </>
      )}
    </aside>
  );
}
