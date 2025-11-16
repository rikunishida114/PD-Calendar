// app/components/SingleTaskForm.tsx
/**
 * このファイルの役割
 * - 「単一タスク追加フォーム」の UI 専用コンポーネント
 * - 状態や Firestore への保存ロジックは親（AddTodoForm）に委ねる
 *
 * 設計方針
 * - 「見た目・入力イベントを受け取る部分」と「ビジネスロジック」を分離することで、
 *   後からロジックを差し替えやすくする。
 * - props 経由で状態とイベントを受け取る「Controlled Component」として実装。
 *
 * 関連コンポーネント
 * - AddTodoForm（コンテナ）
 * - MultiTaskForm（複数タスク版フォーム）
 */

import React from "react";
import type { SingleForm } from "./addTodoTypes";

type SingleTaskFormProps = {
  single: SingleForm;
  sending: boolean;
  onChangeSingle: <K extends keyof SingleForm>(
    key: K,
    value: SingleForm[K]
  ) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onCancel: () => void;
};

const SingleTaskForm: React.FC<SingleTaskFormProps> = ({
  single,
  sending,
  onChangeSingle,
  onSubmit,
  onCancel,
}) => {
  // UI 側は「どのイベントで何の値を親に渡しているか」に集中させる
  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      {/* --- タイトル入力 --- */}
      <label>
        <div style={{ fontSize: 13 }}>タイトル（必須）</div>
        <input
          value={single.title}
          onChange={(e) => onChangeSingle("title", e.target.value)}
          placeholder="例: Related Work をまとめる"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
          disabled={sending}
        />
      </label>

      {/* --- 日付と想定分数 --- */}
      <div style={{ display: "flex", gap: 8 }}>
        {/* 日付 */}
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>日付</div>
          <input
            type="date"
            value={single.date}
            onChange={(e) => onChangeSingle("date", e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
            disabled={sending}
          />
        </label>

        {/* 想定分数
            - value を number | "" に統一するため、
              空文字ならそのまま、数値なら Number() して渡す。
        */}
        <label style={{ width: 160 }}>
          <div style={{ fontSize: 13 }}>想定分数</div>
          <input
            type="number"
            value={single.estimatedMin === "" ? "" : single.estimatedMin}
            onChange={(e) =>
              onChangeSingle(
                "estimatedMin",
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
            disabled={sending}
          />
        </label>
      </div>

      {/* --- フォルダ入力（任意） --- */}
      <label>
        <div style={{ fontSize: 13 }}>フォルダ（任意）</div>
        <input
          value={single.folder}
          onChange={(e) => onChangeSingle("folder", e.target.value)}
          placeholder="例: 研究 / 授業 / 家事"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
          disabled={sending}
        />
      </label>

      {/* --- 送信ボタン群 --- */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            background: "#059669",
            color: "white",
            border: "none",
          }}
        >
          {sending ? "送信中..." : "追加する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
          }}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};

export default SingleTaskForm;
