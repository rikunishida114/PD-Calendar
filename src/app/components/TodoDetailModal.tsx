// src/app/components/TodoDetailModal.tsx
// 詳細モーダル：タイトル・説明・日付・フォルダ・想定分数・完了を編集
// period は使わないように変更済み

"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TodoDetailModal({
  todoId,
  onClose,
}: {
  todoId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Firestore から 1 件読み込む
  useEffect(() => {
    if (!todoId) return;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "plans", todoId));
        if (snap.exists()) {
          const d = snap.data() as any;
          setData({
            ...d,
            // estimatedMin は数値以外なら空文字にしておく（input 用）
            estimatedMin:
              typeof d.estimatedMin === "number" ? d.estimatedMin : "",
          });
        } else {
          setData(null);
        }
      } catch (e) {
        console.error("TodoDetailModal getDoc error", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [todoId]);

  if (loading)
    return <div style={{ padding: 20 }}>読み込み中...</div>;
  if (!data)
    return (
      <div style={{ padding: 20 }}>
        データが見つかりませんでした。
      </div>
    );

  // 共通フィールド更新（title, description, date, folder, done など）
  const setField = (k: string, v: any) =>
    setData((d: any) => ({ ...d, [k]: v }));

  // 保存処理
  const handleSave = async () => {
    try {
      setSaving(true);

      // 想定分数の整形（空文字なら null、数字なら number）
      let estimatedValue: number | null = null;
      if (data.estimatedMin !== "" && data.estimatedMin != null) {
        const n = Number(data.estimatedMin);
        if (Number.isNaN(n)) {
          alert("想定分数は数値で入力してください。");
          setSaving(false);
          return;
        }
        estimatedValue = n;
      }

      await updateDoc(doc(db, "plans", todoId), {
        // undefined は Firestore が嫌うので、空文字や null に寄せる
        title: data.title ?? "",
        description: data.description ?? "",
        date: data.date ?? "", // "YYYY-MM-DD" で扱う
        folder: data.folder ?? "",
        estimatedMin: estimatedValue, // null または number
        done: !!data.done,
        // period はもう使わないので書き込まない
      });

      onClose();
    } catch (e: any) {
      console.error("TodoDetailModal updateDoc error", e);
      alert(
        `保存に失敗しました: ${e?.code || e?.message || String(e)}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    // 背景クリックで閉じる
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          margin: "6vh auto",
          background: "white",
          padding: 16,
          borderRadius: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>
          {data.title || "（タイトルなし）"}
        </h3>

        {/* タイトル */}
        <label style={{ display: "block", marginTop: 8 }}>
          タイトル
          <input
            value={data.title || ""}
            onChange={(e) => setField("title", e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>

        {/* 説明 */}
        <label style={{ display: "block", marginTop: 8 }}>
          説明
          <textarea
            value={data.description || ""}
            onChange={(e) =>
              setField("description", e.target.value)
            }
            style={{ width: "100%", marginTop: 4, minHeight: 80 }}
          />
        </label>

        {/* 日付（既存の date フィールド："YYYY-MM-DD" 文字列） */}
        <label style={{ display: "block", marginTop: 8 }}>
          日付
          <input
            type="date"
            value={data.date || ""}
            onChange={(e) => setField("date", e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>

        {/* フォルダ（フォルダ名をそのまま文字列で保存） */}
        <label style={{ display: "block", marginTop: 8 }}>
          フォルダ
          <input
            value={data.folder || ""}
            onChange={(e) => setField("folder", e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
            placeholder="例：論文紹介 / 修士論文 など"
          />
        </label>

        {/* 想定分数（estimatedMin） */}
        <label style={{ display: "block", marginTop: 8 }}>
          想定分数（分）
          <input
            type="number"
            min={0}
            value={data.estimatedMin ?? ""}
            onChange={(e) =>
              setData((d: any) => ({
                ...d,
                estimatedMin:
                  e.target.value === ""
                    ? ""
                    : Number(e.target.value),
              }))
            }
            style={{ marginTop: 4, width: 120 }}
          />
        </label>

        {/* 完了フラグ */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          <input
            type="checkbox"
            checked={!!data.done}
            onChange={(e) => setField("done", e.target.checked)}
          />
          <span>完了したタスクとして扱う</span>
        </label>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button onClick={onClose} disabled={saving}>
            閉じる
          </button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
