// src/app/components/FolderSidebar.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase"; // あなたの構成に合わせてパスを修正してください

// フォルダ情報の型
type FolderInfo = {
  id: string;    // URL用の識別子（ここでは encodeURIComponent(name) を使用）
  name: string;
  total: number;
  done: number;
};

export default function FolderSidebar() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, { total: number; done: number }>();

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const folderName: string = (d.folder && typeof d.folder === "string" && d.folder.trim()) ? d.folder.trim() : "（未分類）";
          const doneFlag: boolean = !!d.done;

          if (!map.has(folderName)) map.set(folderName, { total: 0, done: 0 });
          const cur = map.get(folderName)!;
          cur.total += 1;
          if (doneFlag) cur.done += 1;
        });

        const arr: FolderInfo[] = Array.from(map.entries()).map(([name, v]) => ({
          id: encodeURIComponent(name), // URL safe id
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

    return () => unsubscribe();
  }, []);

  const percent = (f: FolderInfo) => {
    if (f.total === 0) return 0;
    return Math.round((f.done / f.total) * 100);
  };

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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: collapsed ? 0 : 8 }}>
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

      {collapsed ? (
        <div style={{ writingMode: "vertical-rl", textAlign: "center", fontSize: 12 }}>Folders</div>
      ) : (
        <>
          <h4 style={{ margin: "0 0 8px 0" }}>フォルダ</h4>
          {loading && <div>集計中…</div>}
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
                    <Link href={`/todo/folder/${f.id}`} style={{ textDecoration: "none", color: "inherit" }}>
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
            {folders.length === 0 && !loading && <li style={{ color: "#666" }}>フォルダがありません</li>}
          </ul>
        </>
      )}
    </aside>
  );
}
