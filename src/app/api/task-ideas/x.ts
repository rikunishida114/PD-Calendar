// src/app/api/task-ideas/route.ts
// Next.js App Router の Route Handler。
// ここでフロントから送られた「目的＋課題リスト」を GPT に投げて
// 「細かいタスク案（title と goal）」の配列を JSON で返します。

import { NextResponse } from "next/server";

// フロントから送られてくる想定の型
type TaskIdeasRequest = {
  purpose?: string;  // 目的（例：修士論文を3月までに書き終える）
  goals: string[];   // 課題リスト（1行1課題）
};

// GPT から返してほしい JSON の型イメージ
type TaskIdea = {
  goal: string;   // どの元課題から分解されたか
  title: string;  // 実際のタスクタイトル
};

type TaskIdeasResponse = {
  suggestions: TaskIdea[];
};

// POST /api/task-ideas
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TaskIdeasRequest;

    // 簡単なバリデーション
    if (!body.goals || body.goals.length === 0) {
      return NextResponse.json(
        { error: "goals が空です（少なくとも1行の課題を送ってください）" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY が設定されていません");
      return NextResponse.json(
        { error: "サーバーの OpenAI API キーが未設定です" },
        { status: 500 }
      );
    }

    // --- プロンプトを組み立てる ---
    const purpose = body.purpose || "（目的は特に指定されていない）";

    const goalsText = body.goals
      .map((g, i) => `- 課題${i + 1}: ${g}`)
      .join("\n");

    // GPT に「絶対に JSON だけ返して」と強くお願いする。
    // response_format: { type: "json_object" } を指定することで
    // モデル側にも JSON で返すモードに入ってもらう。
    const systemPrompt = `
あなたは学習計画立案アシスタントです。
ユーザーの「目的」と「複数の課題」から、実行可能な細かいタスクに分解してください。

出力は必ず次の JSON 形式「のみ」とします：

{
  "suggestions": [
    { "goal": "<元の課題1>", "title": "<分解されたタスクタイトル1>" },
    { "goal": "<元の課題1>", "title": "<分解されたタスクタイトル2>" },
    ...
  ]
}

- suggestions は 5〜15 個程度を目安にしてください。
- title は TODO リストにそのまま登録できる、短い日本語にしてください。
- goal には、元になった課題文をそのまま入れてください。
`.trim();

    const userPrompt = `
目的:
${purpose}

課題リスト:
${goalsText}
`.trim();

    // --- OpenAI Chat Completions API を叩く ---
    // ※ Next.js では fetch はサーバーでもそのまま使えます。
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 例: 比較的軽量なモデルを想定（必要に応じて変更可）
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // JSON オブジェクトとして返すように指示
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI API error:", openaiRes.status, text);
      return NextResponse.json(
        { error: "OpenAI API 呼び出しに失敗しました" },
        { status: 500 }
      );
    }

    const json = (await openaiRes.json()) as any;

    // choices[0].message.content に JSON 文字列が入っている想定
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      console.error("OpenAI response に content がありません:", json);
      return NextResponse.json(
        { error: "OpenAI の応答形式が想定外です" },
        { status: 500 }
      );
    }

    // content は JSON テキストのはずなので parse する
    let parsed: TaskIdeasResponse;
    try {
      parsed = JSON.parse(content) as TaskIdeasResponse;
    } catch (e) {
      console.error("JSON.parse 失敗:", e, "content:", content);
      return NextResponse.json(
        { error: "OpenAI の応答を JSON として解釈できませんでした" },
        { status: 500 }
      );
    }

    // suggestions がなければ空配列を返す
    const suggestions = parsed.suggestions ?? [];

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("/api/task-ideas で予期せぬエラー:", e);
    return NextResponse.json(
      { error: "サーバー内部でエラーが発生しました" },
      { status: 500 }
    );
  }
}
