// src/app/api/task-ideas/route.ts
import { NextRequest, NextResponse } from "next/server";

// OpenAI の API キーは .env.local の OPENAI_API_KEY を利用
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST /api/task-ideas
export async function POST(req: NextRequest) {
  try {
    // ① リクエストボディをパース
    const body = await req.json().catch(() => ({}));
    const purpose: string | undefined = body?.purpose;
    const goals: string[] | undefined = body?.goals;

    console.log("[task-ideas] request body:", body);

    // ② バリデーション：purpose は必須、goals は任意に変更
    if (!purpose || typeof purpose !== "string" || !purpose.trim()) {
      return NextResponse.json(
        { error: "purpose が空です（目的を1行のテキストで送ってください）" },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error("[task-ideas] OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "サーバー側の OpenAI API キーが設定されていません" },
        { status: 500 }
      );
    }

    // ③ LLM に渡す「課題リスト」を決める
    //    - goals があればそれを使う
    //    - goals が空 or 未指定なら、「目的」そのものを1件の課題として扱う
    const mergedGoals: string[] =
      goals && Array.isArray(goals) && goals.length > 0
        ? goals.map((g) => String(g))
        : [purpose];

    console.log("[task-ideas] mergedGoals for prompt:", mergedGoals);

    // ④ プロンプトを組み立てる
    //    あなたの好きな日本語プロンプトに調整してOK
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
`;

    // 目的＋課題（補足）をまとめたユーザーメッセージ
    const userPrompt = `
目的:
${purpose}

補足や達成イメージ・課題のリスト:
${mergedGoals.map((g, i) => `- ${g}`).join("\n")}

この目的を達成するための具体的なタスクを、5〜15個くらいに分解してください。
`;

    console.log("[task-ideas] calling OpenAI...");

    // ⑤ OpenAI Chat Completions を直接 fetch で呼び出す
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // 好きなモデルに変更可
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      }
    );

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error(
        "[task-ideas] OpenAI API error:",
        openaiRes.status,
        errorText
      );
      return NextResponse.json(
        { error: "LLM API の呼び出しに失敗しました" },
        { status: 500 }
      );
    }

    const json = await openaiRes.json();
    // content 部分をパース
    const rawContent: string | undefined =
      json?.choices?.[0]?.message?.content;
    console.log("[task-ideas] raw LLM content:", rawContent);

    if (!rawContent) {
      return NextResponse.json(
        { error: "LLM から内容のないレスポンスが返ってきました" },
        { status: 500 }
      );
    }

    // ⑥ LLM から返ってきた JSON テキストをパース
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.error("[task-ideas] JSON.parse error:", e);
      return NextResponse.json(
        { error: "LLM からのレスポンスを JSON として解釈できませんでした" },
        { status: 500 }
      );
    }

    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    console.log("[task-ideas] parsed tasks:", tasks);

    // ⑦ フロントに返す形式に整形
    //    → TaskIdeasPanel 側が data.tasks または data.suggestions のどちらでも受け取れるようにしてある
    return NextResponse.json(
      {
        tasks: tasks.map((t: any) => ({
          title: String(t.title ?? "").trim(),
          estimatedMin:
            typeof t.estimatedMin === "number" ? t.estimatedMin : null,
          // 将来日付を使いたくなった場合に備えてフィールドだけは残しておく
          date:
            typeof t.date === "string" || t.date == null
              ? t.date ?? null
              : null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[task-ideas] unexpected error:", err);
    return NextResponse.json(
      { error: "サーバー内部でエラーが発生しました" },
      { status: 500 }
    );
  }
}
