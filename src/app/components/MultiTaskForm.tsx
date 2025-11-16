// app/components/MultiTaskForm.tsx
/**
 * このファイルの役割
 * - 「目的＋タスク群」をまとめて登録する複数タスクフォームの UI コンポーネント
 * - サブタスク配列の編集 UI を担当し、状態操作は親（AddTodoForm）に委ねる
 *
 * 設計方針
 * - 目的（フォルダ名）とサブタスク一覧を props として受け取る Controlled Component。
 * - 「どのボタンでどのハンドラを呼ぶか」が追いやすい実装にする。
 *
 * 関連コンポーネント
 * - AddTodoForm（コンテナ）
 * - SingleTaskForm
 */

import React from "react";
import type { SubTask } from "./addTodoTypes";

type MultiTaskFormProps = {
  purpose: string;
  subtasks: SubTask[];
  sending: boolean;
  onChangePurpose: (value: string) => void;
  onAddSubtask: () => void;
  onRemoveSubtask: (id: string) => void;
  onUpdateSubtask: <K extends keyof SubTask>(
    id: string,
    field: K,
    value: SubTask[K]
  ) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onCancel: () => void;
};

const MultiTaskForm: React.FC<MultiTaskFormProps> = ({
  purpose,
  subtasks,
  sending,
  onChangePurpose,
  onAddSubtask,
  onRemoveSubtask,
  onUpdateSubtask,
  onSubmit,
  onCancel,
}) => {
  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      {/* --- 目的（フォルダ名）入力 --- */}
      <label>
        <div style={{ fontSize: 13 }}>目的（フォルダ名・必須）</div>
        <input
          value={purpose}
          onChange={(e) => onChangePurpose(e.target.value)}
          placeholder="例: 修士論文の関連研究まとめ"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
          disabled={sending}
        />
      </label>

      {/* --- サブタスク一覧 --- */}
      <div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>タスク（複数可）</div>

        {/* 各サブタスクの入力ブロック */}
        {subtasks.map((s, idx) => (
          <div
            key={s.id}
            style={{
              border: "1px solid #eee",
              padding: 8,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {/* タイトル行＋削除ボタン */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={s.title}
                onChange={(e) => onUpdateSubtask(s.id, "title", e.target.value)}
                placeholder={`タスク ${idx + 1} の内容`}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => onRemoveSubtask(s.id)}
                disabled={sending}
                style={{
                  padding: "6px 8px",
                }}
              >
                削除
              </button>
            </div>

            {/* 日付＋想定分数 */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                type="date"
                value={s.date ?? ""}
                onChange={(e) => onUpdateSubtask(s.id, "date", e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                disabled={sending}
              />

              <input
                type="number"
                value={s.estimatedMin === "" ? "" : s.estimatedMin}
                onChange={(e) =>
                  onUpdateSubtask(
                    s.id,
                    "estimatedMin",
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="想定分(分)"
                style={{
                  width: 160,
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                disabled={sending}
              />
            </div>
          </div>
        ))}

        {/* サブタスク追加ボタン */}
        <button
          type="button"
          onClick={onAddSubtask}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
          }}
        >
          タスクを追加
        </button>
      </div>

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
          {sending ? "送信中..." : "一括追加する"}
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

export default MultiTaskForm;
