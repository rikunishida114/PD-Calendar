// src/app/components/TodoDetailModal.tsx
"use client";

/**
 * TodoDetailModal.tsx
 *
 * このファイルの役割
 * - 1件の TODO（plans コレクションのドキュメント）を詳細表示・編集するモーダル。
 * - 編集項目:
 *   - タイトル
 *   - 説明
 *   - 日付 (YYYY-MM-DD)
 *   - フォルダ名
 *   - 想定分数（estimatedMin）
 *   - 完了フラグ（done）
 * - 変更内容を Firestore に updateDoc で保存する。
 *
 * 設計方針
 * - モーダル自体は「1件の Todo の CRUD UI」のうち、「読み込み + 更新」に責務を限定。
 *   - 削除など他の操作が必要な場合は、別ボタン/別コンポーネントで拡張可能な構造にしておく。
 * - フォーム入力で扱う estimatedMin は `number | ""` に統一。
 *   - Firestore には `number | null` として保存し、空文字は null に変換してから送る。
 *
 * 関連コンポーネント / モジュール
 * - DayView / FolderTasks など
 *   - それぞれの一覧画面からこのモーダルを呼び出す。
 * - Firestore plans コレクション
 */

import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---- 型定義 -------------------------------------------------------------------

/**
 * モーダル内で扱う Todo データの型
 * - Firestore の plans ドキュメントをそのまま any で使うと見通しが悪いので、
 *   UI で編集するフィールドを明示した型を定義しておく。
 */
type TodoDetailData = {
  title: string;
  description: string;
  date: string; // "YYYY-MM-DD" or ""
  folder: string;
  estimatedMin: number | ""; // フォーム内は number | "" に統一
  done: boolean;
};

// ---- Props -------------------------------------------------------------------

type TodoDetailModalProps = {
  todoId: string;
  onClose: () => void;
};

// ---- コンポーネント本体 ------------------------------------------------------

export default function TodoDetailModal({
  todoId,
  onClose,
}: TodoDetailModalProps) {
  // Firestore から読み込んだ Todo データ（UI 用に整形済み）
  const [data, setData] = useState<TodoDetailData | null>(null);

  // 読み込み中・保存中状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ========================================================================
  // ① Firestore から対象 Todo を 1 件読み込む
  // ========================================================================

  useEffect(() => {
    if (!todoId) return;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "plans", todoId));
        if (snap.exists()) {
          const d = snap.data() as any;

          // Firestore 上は undefined や null もあり得るので、
          // UI の型 TodoDetailData に合うように補正してから setData する。
          const normalized: TodoDetailData = {
            title: typeof d.title === "string" ? d.title : "",
            description:
              typeof d.description === "string" ? d.description : "",
            date: typeof d.date === "string" ? d.date : "",
            folder: typeof d.folder === "string" ? d.folder : "",
            estimatedMin:
              typeof d.estimatedMin === "number" ? d.estimatedMin : "",
            done: !!d.done,
          };

          setData(normalized);
        } else {
          // ドキュメントが存在しない場合
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

  // 読み込み中表示
  if (loading) {
    return <div style={{ padding: 20 }}>読み込み中...</div>;
  }

  // データが存在しなかった場合
  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        データが見つかりませんでした。
      </div>
    );
  }

  // ========================================================================
  // ② フィールド更新用ヘルパー
  // ========================================================================

  /**
   * 汎用的なフィールド更新関数
   * - k: TodoDetailData のキー
   * - v: 新しい値
   */
  const setField = <K extends keyof TodoDetailData>(k: K, v: TodoDetailData[K]) =>
    setData((prev) => (prev ? { ...prev, [k]: v } : prev));

  // ========================================================================
  // ③ 保存処理（Firestore update）
  // ========================================================================

  const handleSave = async () => {
    if (!data) return;

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

      // Firestore に書き込むデータ
      await updateDoc(doc(db, "plans", todoId), {
        // undefined は Firestore が嫌うので、空文字や null に寄せる
        title: data.title ?? "",
        description: data.description ?? "",
        date: data.date ?? "", // "YYYY-MM-DD" 文字列 or ""
        folder: data.folder ?? "",
        estimatedMin: estimatedValue, // number | null
        done: !!data.done,
        // period はもう使わないので書き込まない（過去のフィールドが残っていても更新しない）
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

  // ========================================================================
  // ④ JSX（モーダル表示）
  // ========================================================================

  return (
    // 背景（グレー）クリックで閉じる
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      {/* モーダル本体（クリックバブルを止めて背景クリックと区別） */}
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
        {/* ヘッダー（タイトルプレビュー） */}
        <h3 style={{ marginTop: 0 }}>
          {data.title || "（タイトルなし）"}
        </h3>

        {/* タイトル入力 */}
        <label style={{ display: "block", marginTop: 8 }}>
          タイトル
          <input
            value={data.title}
            onChange={(e) => setField("title", e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>

        {/* 説明入力 */}
        <label style={{ display: "block", marginTop: 8 }}>
          説明
          <textarea
            value={data.description}
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
            value={data.date}
            onChange={(e) => setField("date", e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>

        {/* フォルダ（フォルダ名をそのまま文字列で保存） */}
        <label style={{ display: "block", marginTop: 8 }}>
          フォルダ
          <input
            value={data.folder}
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
              setField(
                "estimatedMin",
                e.target.value === ""
                  ? ""
                  : Number(e.target.value)
              )
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
            checked={data.done}
            onChange={(e) => setField("done", e.target.checked)}
          />
          <span>完了したタスクとして扱う</span>
        </label>

        {/* フッター（ボタン群） */}
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
