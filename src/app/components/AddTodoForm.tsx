// app/components/AddTodoForm.tsx
"use client";

/**
 * このファイルの役割
 * - 「タスク追加画面」のコンテナコンポーネント
 * - モード切替（単一 / 複数 / AI）、フォーム状態、Firestore への保存処理を一手に引き受ける
 *
 * 設計方針
 * - UI 部分（フォーム）は SingleTaskForm / MultiTaskForm に分離し、
 *   ここでは「状態管理と副作用（Firestore / 画面遷移）」に集中する。
 * - estimatedMin は「フォーム内では number | ""」「保存時に number | null」に変換する
 *   というルールをこのコンテナで統一的に扱う。
 *
 * 関連コンポーネント
 * - SingleTaskForm（単一タスクの UI）
 * - MultiTaskForm（複数タスクの UI）
 * - TaskIdeasPanel（AI によるタスク案生成 UI）
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

import TaskIdeasPanel from "./TaskIdeasPanel";
import SingleTaskForm from "./SingleTaskForm";
import MultiTaskForm from "./MultiTaskForm";
import type {
  SingleForm,
  SubTask,
  EstimatedMinInput,
} from "./addTodoTypes";

// ---- 共通ユーティリティ -----------------------------------------------------

/**
 * YYYY-MM-DD 形式の今日の日付を返すヘルパー
 * - new Date().toISOString() のロジックを1箇所に集約しておくことで、
 *   フォーマット変更が必要になったときに修正箇所を減らす。
 */
const getTodayDateString = () => new Date().toISOString().slice(0, 10);

/**
 * フォーム上の estimatedMin（number | "" | undefined）を
 * Firestore に保存しやすい number | null に正規化するヘルパー。
 *
 * なぜこの変換をまとめているか？
 * - 各 submit 関数の中で同じ if 文を書き始めると、ロジックが重複してバグの温床になるため。
 * - 「空文字や undefined は null として保存する」という意図をここで明示する。
 */
const normalizeEstimatedMin = (
  value: EstimatedMinInput | undefined
): number | null => {
  if (typeof value === "number") return value;
  if (value === "" || value == null) return null;
  // ここには現状到達しないが、型が拡張されたときの保険としてパースしておく
  const parsed = Number(value as any);
  return Number.isNaN(parsed) ? null : parsed;
};

// ---- メインコンポーネント ---------------------------------------------------

export default function AddTodoForm() {
  const router = useRouter();

  // --- モード切替: 単一 / 複数 / AI ---
  const [mode, setMode] = useState<"single" | "multi" | "ai">("single");

  // --- 単一タスクの状態 ---
  const [single, setSingle] = useState<SingleForm>({
    title: "",
    date: getTodayDateString(),
    estimatedMin: "",
    folder: "",
  });

  // --- 複数タスクの状態（目的とサブタスク一覧） ---
  const [purpose, setPurpose] = useState<string>("");
  const [subtasks, setSubtasks] = useState<SubTask[]>([
    {
      id: String(Date.now()),
      title: "",
      date: getTodayDateString(),
      estimatedMin: "",
    },
  ]);

  // --- 送信状態・エラー表示 ---
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- 単一タスクの入力変更ハンドラ ------------------------------

  /**
   * 単一タスクフォームの入力更新
   * - key ごとに value を上書きするシンプルなヘルパー。
   * - Controlled Component なので、必ずこの関数を経由して状態が変わる。
   */
  function onChangeSingle<K extends keyof SingleForm>(
    key: K,
    value: SingleForm[K]
  ) {
    setSingle((prev) => ({ ...prev, [key]: value }));
  }

  // ---- サブタスクの操作系ハンドラ -------------------------------

  /** サブタスクを1件追加する */
  function addSubtask() {
    setSubtasks((prev) => [
      ...prev,
      {
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        title: "",
        date: getTodayDateString(),
        estimatedMin: "",
      },
    ]);
  }

  /** 指定 id のサブタスクを削除する */
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  /**
   * サブタスクの任意フィールドを更新する
   * - 型の揺れを防ぐため、value の型は SubTask[K] に制限。
   * - これにより estimatedMin も number | "" に統一される。
   */
  function updateSubtask<K extends keyof SubTask>(
    id: string,
    field: K,
    value: SubTask[K]
  ) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  // ---- 単一タスクの送信処理 --------------------------------------

  /**
   * 単一タスクを Firestore に保存する submit ハンドラ
   * - 「タイトル必須」のバリデーション
   * - estimatedMin の正規化
   * - plans コレクションへの addDoc
   */
  async function submitSingle(e?: React.FormEvent) {
    if (e) e.preventDefault();

    // フロント側のバリデーション：タイトル必須
    if (!single.title.trim()) {
      setError("タイトルは必須です。");
      return;
    }

    setError(null);
    setSending(true);

    try {
      const col = collection(db, "plans");

      await addDoc(col, {
        title: single.title,
        date: single.date || null,
        estimatedMin: normalizeEstimatedMin(single.estimatedMin),
        folder: single.folder || null,
        done: false,
        createdAt: serverTimestamp(),
      });

      // 保存が成功したら todo 画面に戻す
      router.push("/todo");
    } catch (err) {
      console.error("add single error", err);
      setError("追加中にエラーが発生しました。コンソールを確認してください。");
    } finally {
      setSending(false);
    }
  }

  // ---- 複数タスクの送信処理 --------------------------------------

  /**
   * 複数タスク（目的＋タスク群）をまとめて Firestore に保存する submit ハンドラ
   *
   * やっていること：
   * 1. 目的（フォルダ名）が空でないかチェック
   * 2. 各サブタスクのタイトル必須チェック
   * 3. plans コレクションにサブタスクを1件ずつ保存
   * 4. taskPatterns コレクションに「目的＋タスク群」を1ドキュメントとして保存
   *
   * 4 を行う理由：
   * - AI によるタスク提案機能（TaskIdeasPanel）が「過去のパターン」から学習するため、
   *   目的とタスク群をセットで保持しておきたい。
   */
  async function submitMulti(e?: React.FormEvent) {
    if (e) e.preventDefault();

    // 目的（フォルダ名）必須
    if (!purpose.trim()) {
      setError("目的（フォルダ名）は必須です。");
      return;
    }

    // 各サブタスクにタイトル必須
    for (const st of subtasks) {
      if (!st.title.trim()) {
        setError("サブタスクには全てタイトルが必要です。");
        return;
      }
    }

    setError(null);
    setSending(true);

    try {
      const plansCol = collection(db, "plans");
      const patternTasks: {
        title: string;
        estimatedMin: number | null;
        date?: string | null;
      }[] = [];

      // 1. 各サブタスクを plans コレクションに保存
      for (const st of subtasks) {
        const estimated = normalizeEstimatedMin(st.estimatedMin);

        await addDoc(plansCol, {
          title: st.title,
          date: st.date || null,
          estimatedMin: estimated,
          folder: purpose, // 目的は folder として plans 側にも保存
          done: false,
          createdAt: serverTimestamp(),
        });

        // 2. 学習用の taskPatterns にも同時に積んでいく
        patternTasks.push({
          title: st.title,
          estimatedMin: estimated,
          date: st.date || null,
        });
      }

      // 3. パターン（目的＋タスク群）を taskPatterns コレクションに1件だけ保存
      const patternsCol = collection(db, "taskPatterns");
      await addDoc(patternsCol, {
        purpose,
        createdAt: serverTimestamp(),
        tasks: patternTasks,
      });

      router.push("/todo");
    } catch (err) {
      console.error("add multi error", err);
      setError("追加中にエラーが発生しました。コンソールを確認してください。");
    } finally {
      setSending(false);
    }
  }

  // ---- AI タブからサブタスクに流し込む処理 ---------------------------

  /**
   * TaskIdeasPanel から受け取ったタスク案を、既存のサブタスクに追加する。
   *
   * ポイント：
   * - TaskIdeasPanel 側も estimatedMin は number | "" で揃えている前提なので、
   *   ここではそのまま SubTask.estimatedMin に渡せる。
   * - AI からタスクが追加されたあと、自動で複数タスクタブに切り替えて UX を良くする。
   */
  const handleApplyIdeasFromAI = (
    ideas: { title: string; date?: string; estimatedMin?: EstimatedMinInput }[]
  ) => {
    setSubtasks((prev) => [
      ...prev,
      ...ideas.map((t, idx) => ({
        id: `${Date.now()}-${idx}-` + Math.random().toString(36).slice(2),
        title: t.title,
        date: t.date ?? getTodayDateString(),
        estimatedMin: t.estimatedMin ?? "",
      })),
    ]);

    setMode("multi");
  };

  // ---- 画面遷移用の共通キャンセルハンドラ -----------------------------

  const handleCancel = () => {
    router.push("/todo");
  };

  // ---- UI（レンダリング） --------------------------------------------

  return (
    <div style={{ padding: 8 }}>
      {/* --- モード切替ボタン群（単一 / 複数 / AI） --- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("single")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: mode === "single" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          単一タスク
        </button>
        <button
          onClick={() => setMode("multi")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: mode === "multi" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          複数タスク（目的＋タスク群）
        </button>
        <button
          onClick={() => setMode("ai")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: mode === "ai" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          AIで作成
        </button>
      </div>

      {/* --- エラーメッセージ --- */}
      {error && (
        <div style={{ color: "red", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* --- 単一タスクフォーム --- */}
      {mode === "single" && (
        <SingleTaskForm
          single={single}
          sending={sending}
          onChangeSingle={onChangeSingle}
          onSubmit={submitSingle}
          onCancel={handleCancel}
        />
      )}

      {/* --- 複数タスクフォーム --- */}
      {mode === "multi" && (
        <MultiTaskForm
          purpose={purpose}
          subtasks={subtasks}
          sending={sending}
          onChangePurpose={setPurpose}
          onAddSubtask={addSubtask}
          onRemoveSubtask={removeSubtask}
          onUpdateSubtask={updateSubtask}
          onSubmit={submitMulti}
          onCancel={handleCancel}
        />
      )}

      {/* --- AI モード：TaskIdeasPanel --- */}
      {mode === "ai" && (
        <div style={{ marginTop: 8 }}>
          <p
            style={{
              fontSize: 13,
              color: "#555",
              marginBottom: 8,
            }}
          >
            過去に登録した「目的＋タスク群」から似たパターンを探して、
            複数タスクフォームに流し込めます。
          </p>
          <TaskIdeasPanel onApplyIdeas={handleApplyIdeasFromAI} />
        </div>
      )}
    </div>
  );
}
