import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable '${name}'. Add it to .env.local and restart the server.`
    );
  }
  return value;
}

function inferMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }

  const extension = file.name?.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      throw new Error("Unsupported image format. Upload PNG, JPG, or WEBP files.");
  }
}

async function fileToInlineData(file: File) {
  const mimeType = inferMimeType(file);
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { mimeType, data: base64 };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("problemImage");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Upload an image of the math problem first." },
        { status: 400 }
      );
    }

    const inlineData = await fileToInlineData(fileEntry);

    const apiKey = getEnvOrThrow("GEMINI_API_KEY");
    const modelName = process.env.GEMINI_MATH_MODEL ?? "gemini-2.5-flash";

    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "You are a meticulous math transcription assistant. Read the math problem in this image and return the exact problem as clean text. Preserve mathematical symbols, fractions, exponents, and equations. Do not solve the problem."
            },
            { inlineData },
          ],
        },
      ],
    });

    const candidate = response.candidates?.[0];

    if (!candidate?.content?.parts) {
      return NextResponse.json(
        { ok: false, message: "Gemini did not return any text for that image." },
        { status: 502 }
      );
    }

    const transcription = candidate.content.parts
      .map((part) => part.text?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join("\n\n");

    if (!transcription) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini could not read that math problem. Try a clearer image.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, problem: transcription });
  } catch (error) {
    console.error("Math analyze handler failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error while reading the math problem.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}