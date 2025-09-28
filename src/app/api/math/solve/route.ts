import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const SOLVER_INSTRUCTION = `You are a helpful math tutor. Solve the user's math problem step-by-step. When you respond, return JSON with two keys: "answer" for the final result and "explanation" for a multi-step explanation with line breaks. Do not include any other commentary outside the JSON.`;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable '${name}'. Add it to .env.local and restart the server.`
    );
  }
  return value;
}

function sanitizeJson(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const json = (await request.json().catch(() => null)) as
      | {
          problem?: unknown;
        }
      | null;

    if (!json || typeof json.problem !== "string") {
      return NextResponse.json(
        { ok: false, message: "Send the transcribed math problem as text before solving." },
        { status: 400 }
      );
    }

    const problem = json.problem.trim();

    if (problem.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Problem text is empty. Provide the equation or question to solve." },
        { status: 400 }
      );
    }

    const apiKey = getEnvOrThrow("GEMINI_API_KEY");
    const modelName = process.env.GEMINI_SOLVER_MODEL ?? "gemini-2.5-flash";

    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SOLVER_INSTRUCTION}\n\nProblem:\n${problem}`,
            },
          ],
        },
      ],
    });

    const candidate = response.candidates?.[0];

    if (!candidate?.content?.parts) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini did not return a solution. Try rephrasing the problem.",
        },
        { status: 502 }
      );
    }

    const raw = candidate.content.parts
      .map((part) => part.text?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join("");

    if (!raw) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini returned an empty response. Try again.",
        },
        { status: 502 }
      );
    }

    let parsed: { answer?: string; explanation?: string };

    try {
      parsed = JSON.parse(sanitizeJson(raw));
    } catch (error) {
      console.error("Failed to parse Gemini JSON", raw, error);
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini responded in an unexpected format. Please try solving again.",
        },
        { status: 502 }
      );
    }

    if (!parsed.answer || !parsed.explanation) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini response missed required fields. Try solving again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      answer: parsed.answer,
      explanation: parsed.explanation,
    });
  } catch (error) {
    console.error("Math solve handler failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while solving the math problem.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}