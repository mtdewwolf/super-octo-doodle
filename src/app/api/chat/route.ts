import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const MAX_CHAT_MESSAGES = 12;
const DEFAULT_CHAT_INSTRUCTION = "You are Gemini 2.5, a collaborative creative partner helping the Nano Banana team explore ideas across design, product strategy, storytelling, and marketing. Offer concise, practical suggestions and ask clarifying questions when it helps.";

type IncomingMessage = {
  role?: string;
  content?: unknown;
};

type SanitizedMessage = {
  role: "user" | "model";
  content: string;
};

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable '${name}'. Add it to .env.local and restart the server.`
    );
  }
  return value;
}

function normalizeMessages(messages: IncomingMessage[]): SanitizedMessage[] {
  const normalized: SanitizedMessage[] = [];

  for (const message of messages) {
    if (!message || typeof message.content !== "string") {
      continue;
    }

    const trimmedContent = message.content.trim();

    if (trimmedContent.length === 0) {
      continue;
    }

    const role = message.role === "model" ? "model" : "user";

    normalized.push({
      role,
      content: trimmedContent,
    });
  }

  return normalized.slice(-MAX_CHAT_MESSAGES);
}

export async function POST(request: Request) {
  try {
    const json = (await request.json().catch(() => null)) as
      | {
          messages?: IncomingMessage[];
        }
      | null;

    if (!json || !Array.isArray(json.messages)) {
      return NextResponse.json(
        { ok: false, message: "Chat request must include an array of messages." },
        { status: 400 }
      );
    }

    const conversation = normalizeMessages(json.messages);

    if (conversation.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Provide a prompt for Gemini to respond to." },
        { status: 400 }
      );
    }

    const apiKey = getEnvOrThrow("GEMINI_API_KEY");
    const modelName = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
    const instruction = (process.env.GEMINI_CHAT_INSTRUCTION ?? DEFAULT_CHAT_INSTRUCTION).trim();

    const genAI = new GoogleGenAI({ apiKey });

    const contents = [] as Array<{ role: string; parts: Array<{ text: string }> }>;

    if (instruction.length > 0) {
      contents.push({
        role: "user",
        parts: [{ text: instruction }],
      });
    }

    contents.push(
      ...conversation.map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      }))
    );

    const response = await genAI.models.generateContent({
      model: modelName,
      contents,
    });

    const candidate = response.candidates?.[0];

    if (!candidate?.content?.parts) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini returned an empty reply. Try asking again.",
        },
        { status: 502 }
      );
    }

    const textResponse = candidate.content.parts
      .map((part) => part.text?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join("\n\n");

    if (!textResponse) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini responded without text content. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      response: {
        role: "model",
        content: textResponse,
      },
    });
  } catch (error) {
    console.error("Gemini chat handler failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while talking to Gemini.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}