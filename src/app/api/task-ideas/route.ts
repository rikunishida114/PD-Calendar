// src/app/api/task-ideas/route.ts
/**
 * このファイルの役割
 * - POST /api/task-ideas の Route Handler（Next.js App Router 用）
 * - フロントから受け取った「目的（purpose）＋課題リスト（goals）」を LLM に渡し、
 *   「細かいタスク案（title, estimatedMin, date）」の配列を JSON で返す。
 *
 * 設計方針
 * - purpose は必須、goals は任意（補足情報があれば精度が上がる）。
 * - 目的だけの入力でも LLM に渡す情報がゼロにならないよう、
 *   goals が空のときは purpose 自体を 1 件の課題として扱う。
 * - LLM の返却値は「一旦 any として受けてから」型を正規化して返す。
 *   → ここで防波堤になっておくと、フロント側の型が安定する。
 *
 * 関連コンポーネント / モジュール
 * - app/components/TaskIdeasPanel
 *   - この API を叩いてタスク案を取得し、AddTodoForm の複数タスクフォームに流し込む。
 * - app/components/AddTodoForm
 *   - estimatedMin を number | "" にしてフォーム内で扱う。
 */

import { NextRequest, NextResponse } from "next/server";

// ---- 定数・環境変数 ----------------------------------------------------------

/**
 * OpenAI の API キー
 * - .env.local の OPENAI_API_KEY を利用する。
 * - 実行時に未設定だと API 全体が動かないため、処理の早い段階でチェックする。
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ---- 型定義 ------------------------------------------------------------------

/** リクエストボディ（フロントから送られてくる想定の型） */
type TaskIdeasRequestBody = {
  purpose?: string;
  goals?: string[];
};

/** LLM から返ってきてほしい tasks 要素の形（ゆるい型） */
type RawLLMTask = {
  title?: unknown;
  estimatedMin?: unknown;
  date?: unknown;
};

/** API としてクライアントに返すタスク型（ここで型を固定する） */
type TaskIdea = {
  title: string;
  estimatedMin: number | null;
  date: string | null;
};

// ---- ユーティリティ関数 ------------------------------------------------------

/**
 * リクエストボディを安全にパースするヘルパー
 * - JSON でない場合などに備えて try-catch し、失敗したら {} を返す。
 * - こうしておくと、Route Handler 側のエラーハンドリングがシンプルになる。
 */
async function parseRequestBody(req: NextRequest): Promise<TaskIdeasRequestBody> {
  try {
    const body = await req.json();
    return (body ?? {}) as TaskIdeasRequestBody;
  } catch {
    return {};
  }
}

/**
 * LLM に渡す「課題リスト」を決める。
 * - goals が空なら purpose 自体を 1 件の課題として扱う。
 * - なぜこうするか？
 *   → 目的だけ入力されたケースでも、LLM がタスク案を生成できるだけのテキストを確保するため。
 */
function buildMergedGoals(purpose: string, goals?: string[]): string[] {
  if (Array.isArray(goals) && goals.length > 0) {
    return goals.map((g) => String(g));
  }
  return [purpose];
}

/**
 * LLM に渡す system / user プロンプトを組み立てる。
 * - systemPrompt: モデルの役割と出力フォーマットの指示。
 * - userPrompt  : ユーザーの目的と課題リスト。
 */
function buildPrompts(purpose: string, mergedGoals: string[]) {
  const systemPrompt = `
あなたは「目的をタスクに分解するアシスタント」です。
ユーザーの目的や状況を読み取り、実行可能な小さなタスクのリストを日本語で提案してください。

出力フォーマットは、必ず次の JSON 形式のみで返してください：

{
  "tasks": [
    { "title": "タスク名", "estimatedMin": 30 },
    { "title": "タスク名2", "estimatedMin": 15 }
  ]
}

- "title": 実行可能な1アクション（～する）で書いてください
- "estimatedMin": だいたいの所要時間（分）。わからなければ null でも構いません
- 日付はここでは決めなくてよいので、含めなくて構いません
`.trim();

  const userPrompt = `
目的:
${purpose}

補足や達成イメージ・課題のリスト:
${mergedGoals.map((g) => `- ${g}`).join("\n")}

この目的を達成するための具体的なタスクを、5〜15個くらいに分解してください。
`.trim();

  return { systemPrompt, userPrompt };
}

/**
 * OpenAI Chat Completions API を呼び出し、content 文字列だけを取り出す。
 * - 呼び出し部分を分離しておくことで、Route Handler 本体の見通しをよくする。
 */
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.error("[task-ideas] OPENAI_API_KEY is not set");
    throw new Error("サーバー側の OpenAI API キーが設定されていません");
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // 必要に応じて他のモデルに変更可
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!openaiRes.ok) {
    const errorText = await openaiRes.text();
    console.error("[task-ideas] OpenAI API error:", openaiRes.status, errorText);
    throw new Error("LLM API の呼び出しに失敗しました");
  }

  const json = await openaiRes.json();
  const rawContent: string | undefined = json?.choices?.[0]?.message?.content;

  if (!rawContent) {
    console.error("[task-ideas] OpenAI response without content:", json);
    throw new Error("LLM から内容のないレスポンスが返ってきました");
  }

  return rawContent;
}

/**
 * LLM から返ってきた JSON テキストをパースし、API レスポンス用に正規化する。
 * - title は必ず string にする（空なら空文字）。
 * - estimatedMin は number | null に揃える（フロント側で number | "" にしやすい）。
 * - date は string | null に揃える（将来の拡張用）。
 */
function parseAndNormalizeTasks(rawContent: string): TaskIdea[] {
  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    console.error("[task-ideas] JSON.parse error:", e, "content:", rawContent);
    throw new Error("LLM からのレスポンスを JSON として解釈できませんでした");
  }

  const tasks: RawLLMTask[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  console.log("[task-ideas] parsed tasks:", tasks);

  const normalizeEstimatedMin = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };

  const normalizeDate = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (v == null) return null;
    return null;
  };

  const normalized: TaskIdea[] = tasks.map((t) => ({
    title: String(t.title ?? "").trim(),
    estimatedMin: normalizeEstimatedMin(t.estimatedMin),
    date: normalizeDate(t.date),
  }));

  console.log("[task-ideas] normalized tasks:", normalized);
  return normalized;
}

// ---- Route Handler 本体 ------------------------------------------------------

/**
 * POST /api/task-ideas
 * - 目的＋課題を受け取り、LLM でタスク案を生成して返す。
 */
export async function POST(req: NextRequest) {
  try {
    // ① リクエストボディをパース
    const body = await parseRequestBody(req);
    const purpose = body.purpose;
    const goals = body.goals;

    console.log("[task-ideas] request body:", body);

    // ② バリデーション：purpose は必須
    if (!purpose || typeof purpose !== "string" || !purpose.trim()) {
      return NextResponse.json(
        { error: "purpose が空です（目的を1行のテキストで送ってください）" },
        { status: 400 }
      );
    }

    // ③ LLM に渡す課題リストを決める
    const mergedGoals = buildMergedGoals(purpose, goals);
    console.log("[task-ideas] mergedGoals for prompt:", mergedGoals);

    // ④ プロンプトを組み立てて LLM を呼び出す
    const { systemPrompt, userPrompt } = buildPrompts(purpose, mergedGoals);
    console.log("[task-ideas] calling OpenAI...");
    const rawContent = await callOpenAI(systemPrompt, userPrompt);
    console.log("[task-ideas] raw LLM content:", rawContent);

    // ⑤ レスポンスをパース＆正規化
    const tasks = parseAndNormalizeTasks(rawContent);

    // ⑥ フロントに返す形式に整形
    //    （TaskIdeasPanel 側が data.tasks or data.suggestions などを想定しているなら、
    //      必要に応じてここでプロパティを増やす）
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (err: any) {
    console.error("[task-ideas] unexpected error:", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "サーバー内部でエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
