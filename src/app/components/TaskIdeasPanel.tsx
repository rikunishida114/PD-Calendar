// src/app/components/TaskIdeasPanel.tsx
// 「AIで作成」タブ用パネル
//
// 役割：
//  - ユーザーが「目的（例: 修士論文を3月までに終わらせる）」を入力
//  - まずは Firestore の taskPatterns コレクションから類似パターンを検索（ローカル学習ベース）
//     → ここで「目的＋補足」のテキストを使って類似度を計算する
//  - 見つかればそのタスク群を候補として表示
//  - 見つからない場合だけ、「クラウドAI（/api/task-ideas）を試しますか？」ボタンを表示
//  - ユーザーが明示的に許可した場合のみ LLM を呼び出す
//
// 就活向け説明：
//  「ユーザー自身の過去データ（目的＋タスク分解）を優先的に再利用し、
//    それでも足りない場合だけクラウドAIをオプションとして呼び出すハイブリッド設計」
//  → コスト最適化＆プライバシー配慮の構成。

"use client";

import React, { useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// 親フォーム（複数タスク入力フォーム）にタスク案を流し込むための型
type TaskIdeasPanelProps = {
  onApplyIdeas?: (
    tasks: { title: string; date?: string; estimatedMin?: number | "" }[]
  ) => void;
};

// taskPatterns コレクション1件ぶんの最低限の構造
type TaskPatternDoc = {
  purpose: string;
  tasks: {
    title: string;
    estimatedMin?: number | null;
    date?: string | null;
  }[];
};

// 文字列を簡易キーワード配列に変換する（日本語もそこそこ動く素朴なやつ）
// - 句読点や改行をスペースにしてから split
function toKeywords(text: string): string[] {
  return text
    .replace(/[、。．,.！？!?\n]/g, " ") // 句読点類をスペースに
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

// 2つの文字列の「それっぽい類似度」を 0〜1 で返す
// - Jaccard 係数風: 共通キーワード数 / (A∪B のサイズ)
function similarity(a: string, b: string): number {
  const ak = toKeywords(a);
  const bk = toKeywords(b);
  if (ak.length === 0 || bk.length === 0) return 0;

  const setA = new Set(ak);
  const setB = new Set(bk);

  let common = 0;
  setA.forEach((w) => {
    if (setB.has(w)) common++;
  });

  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize === 0 ? 0 : common / unionSize;
}

export default function TaskIdeasPanel({ onApplyIdeas }: TaskIdeasPanelProps) {
  // ユーザーが入力する「目的」（例: 修士論文を3月までに終わらせる）
  const [purposeInput, setPurposeInput] = useState("");
  // 補足情報（任意） - ローカル類似度計算にも LLM にもヒントとして使う
  const [goalInput, setGoalInput] = useState("");

  // 生成されたタスク候補（ローカル or LLM いずれかの結果）
  const [suggestedTasks, setSuggestedTasks] = useState<
    { title: string; date?: string; estimatedMin?: number | "" }[]
  >([]);

  // 状態系
  const [loadingLocal, setLoadingLocal] = useState(false);  // ローカル検索中
  const [loadingLLM, setLoadingLLM] = useState(false);      // LLM 呼び出し中
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canTryLLM, setCanTryLLM] = useState(false);        // LLM フォールバックを出してよい状態かどうか

  // --------------------------------------------------------
  // ① ローカル学習（taskPatterns）からの候補生成
  //    → 目的だけ必須、補足があれば類似度の精度アップに使う
  // --------------------------------------------------------
  async function handleGenerateFromLocalPatterns() {
    if (!purposeInput.trim()) {
      setErrorMessage("まず目的を入力してください。");
      return;
    }

    setLoadingLocal(true);
    setLoadingLLM(false);
    setErrorMessage(null);
    setInfoMessage("これまでのタスク分解の履歴から、似た目的のパターンを探しています...");
    setCanTryLLM(false); // 一度リセット

    try {
      // 0. 類似度計算に使う「ユーザー側テキスト」
      //    - 目的 + 補足を単純に連結 → 補足を書いたときはキーワードが増えてマッチしやすくなる
      const userText =
        goalInput.trim().length > 0
          ? `${purposeInput} ${goalInput}`
          : purposeInput;

      // 1. 最近の taskPatterns を取得（createdAt 降順に最大50件）
      const patternsRef = collection(db, "taskPatterns");
      const q = query(patternsRef, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);

      const patterns: TaskPatternDoc[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (!data) return;
        if (!data.purpose || !Array.isArray(data.tasks)) return;

        patterns.push({
          purpose: String(data.purpose),
          tasks: data.tasks.map((t: any) => ({
            title: String(t.title ?? ""),
            estimatedMin:
              typeof t.estimatedMin === "number" ? t.estimatedMin : null,
            date:
              typeof t.date === "string" || t.date == null
                ? t.date ?? null
                : null,
          })),
        });
      });

      if (patterns.length === 0) {
        // まだ学習データがない場合
        setSuggestedTasks([]);
        setInfoMessage(
          "まだタスク分解の履歴がありません。複数タスク機能でいくつか目的＋タスク群を登録すると、ここに候補が表示されるようになります。"
        );
        // LLM を試すオプションを出してもよい（任意）
        setCanTryLLM(true);
        return;
      }

      // 2. 類似度を計算してスコア順にソート
      const scored = patterns
        .map((p) => ({
          pattern: p,
          // ★ ここで userText（目的＋補足）を使って類似度を評価
          score: similarity(userText, p.purpose),
        }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];

      // 3. 類似度が低すぎる場合は「ローカルからは見つからない」とする
      if (!best || best.score < 0.1) {
        setSuggestedTasks([]);
        setInfoMessage(
          "近い目的のパターンはローカル履歴から見つかりませんでした。必要であれば、下のボタンからクラウドAIに相談することもできます。"
        );
        // ここで LLM ボタンを有効化
        setCanTryLLM(true);
        return;
      }

      // 4. 最も類似度の高いパターンの tasks を候補として採用
      const mappedTasks: {
        title: string;
        date?: string;
        estimatedMin?: number | "";
      }[] = best.pattern.tasks.map((t) => {
        let est: number | "" = "";
        if (typeof t.estimatedMin === "number") {
          est = t.estimatedMin;
        }
        return {
          title: t.title,
          date: t.date ?? "",
          estimatedMin: est,
        };
      });

      setSuggestedTasks(mappedTasks);
      setInfoMessage(
        `「${best.pattern.purpose}」という過去の目的からタスク候補を提案しています（類似度: ${best.score.toFixed(
          2
        )}）。`
      );
      setCanTryLLM(false); // ローカルで十分な候補が出たので、フォールバックは一旦オフ
    } catch (err) {
      console.error("TaskIdeasPanel local pattern error", err);
      setErrorMessage(
        "過去のパターンの読み込みに失敗しました。ネットワークまたは Firestore の設定を確認してください。"
      );
      setSuggestedTasks([]);
      setCanTryLLM(true); // ローカルが壊れている場合も、LLM オプションを出しておく
    } finally {
      setLoadingLocal(false);
    }
  }

  // --------------------------------------------------------
  // ② LLM フォールバック（/api/task-ideas）を使う処理
  //    ※ 実行前に confirm でユーザーに本当に使うかを確認する
  //    ※ 目的だけでも呼べる。補足を書けば LLM 側の精度が上がる。
  // --------------------------------------------------------
  async function handleGenerateFromLLM() {
    if (!purposeInput.trim()) {
      setErrorMessage("まず目的を入力してください。");
      return;
    }

    // ユーザーに確認（料金が発生する可能性を明示）
    const ok = window.confirm(
      "クラウド上のAIサービスに、入力した目的や補足情報を送信してタスク候補を生成します。\n" +
        "ご利用のAPIプランによっては料金が発生する場合があります。\n\n" +
        "本当に実行しますか？"
    );
    if (!ok) return;

    setLoadingLLM(true);
    setErrorMessage(null);
    setInfoMessage("クラウドAIにタスク分解を依頼しています...");

    try {
      // /api/task-ideas は、サーバー側で OpenAI などの LLM を呼び出すエンドポイント
      const res = await fetch("/api/task-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // goalInput は任意の補足説明として一緒に送る（あれば精度アップに使われる）
        body: JSON.stringify({
          purpose: purposeInput,
          goals: goalInput ? [goalInput] : [],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("task-ideas API error:", res.status, text);
        setErrorMessage(
          "クラウドAIによるタスク生成に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }

      const data = await res.json();

      // ★ ここが「フロント側を合わせる」ポイント
      //   - route.ts が { tasks: [...] } を返す場合と
      //   - { suggestions: [...] } を返す場合の両方に対応しておく
      const raw =
        Array.isArray(data.tasks)
          ? data.tasks
          : Array.isArray(data.suggestions)
          ? data.suggestions
          : [];

      // title があるものだけを拾って UI 用の形に整形
      const mappedTasks = raw
        .filter(
          (t: any) =>
            t &&
            typeof t.title === "string" &&
            t.title.trim().length > 0
        )
        .map((t: any) => {
          let est: number | "" = "";
          if (typeof t.estimatedMin === "number") {
            est = t.estimatedMin;
          }
          return {
            title: t.title.trim(),
            // LLM には日付・分数まで決めさせず、ユーザーが後から調整しやすいように空のままにする
            date: t.date ?? "",
            estimatedMin: est,
          };
        });

      if (mappedTasks.length === 0) {
        // ★ ここで、あなたが見ていたメッセージが表示される
        setInfoMessage(
          "クラウドAIから有効なタスク候補が返ってきませんでした。目的文を少し具体的にして、再度お試しください。"
        );
      } else {
        setSuggestedTasks(mappedTasks);
        setInfoMessage(
          "クラウドAIからの提案結果です。内容を確認してから、必要なものだけフォームに適用してください。"
        );
      }
    } catch (e) {
      console.error("TaskIdeasPanel LLM fallback error", e);
      setErrorMessage(
        "クラウドAIの呼び出し中にエラーが発生しました。ネットワークや API キー設定を確認してください。"
      );
    } finally {
      setLoadingLLM(false);
    }
  }

  // --------------------------------------------------------
  // ③ 親フォーム（複数タスクフォーム）にタスク案を反映
  // --------------------------------------------------------
  function handleApplyToMultiForm() {
    if (!onApplyIdeas) {
      console.log(
        "[TaskIdeasPanel] onApplyIdeas が指定されていないため、タスク案の適用は行わずログのみ出力します。",
        suggestedTasks
      );
      return;
    }
    if (suggestedTasks.length === 0) {
      alert("適用できるタスク案がありません。まず候補を生成してください。");
      return;
    }
    onApplyIdeas(suggestedTasks);
  }

  // --------------------------------------------------------
  // JSX（UI部分）
  // --------------------------------------------------------
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
      }}
    >
      {/* タイトル：就活で説明しやすい文言 */}
      <h3 style={{ marginTop: 0 }}>タスク分解アシスタント（ローカル優先＋AIオプション）</h3>
      <p style={{ fontSize: 13, color: "#555" }}>
        これまでに登録した「目的＋複数タスク」の履歴をもとに、似ている目的のタスク候補を自動で提案します。
        まずはローカルの履歴だけを使い、足りない場合にだけクラウド上のAIサービスを任意で利用できる構成です。
      </p>

      {/* 目的入力欄（必須） */}
      <label style={{ display: "block", marginTop: 8 }}>
        <div style={{ fontSize: 13 }}>目的（例: 修士論文を3月までに終わらせる）</div>
        <input
          value={purposeInput}
          onChange={(e) => setPurposeInput(e.target.value)}
          placeholder="目的や大きなゴールを入力してください"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ddd",
            marginTop: 4,
          }}
        />
      </label>

      {/* 補足説明（任意） */}
      <label style={{ display: "block", marginTop: 8 }}>
        <div style={{ fontSize: 13 }}>補足・達成したいイメージ（任意）</div>
        <textarea
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          placeholder="例: 平日は毎日2時間は論文に触れたい、など（書いておくとローカル検索・AIの両方の精度が上がります）"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ddd",
            marginTop: 4,
            minHeight: 60,
          }}
        />
      </label>

      {/* ボタン群 */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        {/* ローカル学習からの提案ボタン */}
        <button
          type="button"
          onClick={handleGenerateFromLocalPatterns}
          disabled={loadingLocal || loadingLLM}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "#2563eb",
            color: "white",
            border: "none",
          }}
        >
          {loadingLocal ? "履歴から検索中..." : "過去のタスク分解から提案"}
        </button>

        {/* LLM フォールバックボタン（必要なときだけ表示） */}
        {canTryLLM && (
          <button
            type="button"
            onClick={handleGenerateFromLLM}
            disabled={loadingLocal || loadingLLM}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: "#f97316",
              color: "white",
              border: "none",
            }}
          >
            {loadingLLM ? "クラウドAIに問い合わせ中..." : "クラウドAIに相談する（要確認）"}
          </button>
        )}

        {/* タスク案を複数タスクフォームに適用 */}
        <button
          type="button"
          onClick={handleApplyToMultiForm}
          disabled={suggestedTasks.length === 0 || loadingLocal || loadingLLM}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #059669",
            background:
              suggestedTasks.length === 0 ? "#f3f4f6" : "#ecfdf5",
            color: "#059669",
            marginLeft: "auto",
          }}
        >
          タスク候補をフォームに反映
        </button>
      </div>

      {/* メッセージ */}
      {infoMessage && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
          {infoMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ marginTop: 8, fontSize: 12, color: "red" }}>
          {errorMessage}
        </div>
      )}

      {/* タスク候補一覧 */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>タスク候補</div>
        {suggestedTasks.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>
            まだタスク候補は表示されていません。「過去のタスク分解から提案」を押してみてください。
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {suggestedTasks.map((t, i) => (
              <li
                key={i}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 6,
                  padding: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {t.date && <span style={{ marginRight: 8 }}>📅 {t.date}</span>}
                  {t.estimatedMin !== "" && t.estimatedMin != null && (
                    <span>⏱ {t.estimatedMin} 分</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
