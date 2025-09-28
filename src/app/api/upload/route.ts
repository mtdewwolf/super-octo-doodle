import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const DEFAULT_PROMPT =
  "Create a polished, high-contrast Nano Banana themed thumbnail that feels modern and clickable.";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable '${name}'. Add it to .env.local and reload the dev server.`
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
    const instructionsEntry = formData.get("instructions");
    const thumbnailEntry = formData.get("thumbnail");

    if (!(thumbnailEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Thumbnail file is required." },
        { status: 400 }
      );
    }

    const instructions =
      typeof instructionsEntry === "string" ? instructionsEntry.trim() : "";
    const prompt = instructions.length > 0 ? instructions : DEFAULT_PROMPT;

    const inlineData = await fileToInlineData(thumbnailEntry);

    const apiKey = getEnvOrThrow("GEMINI_API_KEY");
    const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image-preview";

    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData }],
        },
      ],
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini did not return any image candidates. Try adjusting your prompt.",
        },
        { status: 502 }
      );
    }

    const images: Array<{ mimeType: string; data: string }> = [];
    const notes: string[] = [];

    for (const part of candidate.content?.parts ?? []) {
      if (part.text) {
        notes.push(part.text);
      }

      if (part.inlineData?.data) {
        images.push({
          mimeType: part.inlineData.mimeType ?? "image/png",
          data: part.inlineData.data,
        });
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gemini responded without an image payload. Please try again with a different prompt.",
          notes,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Gemini generated a new thumbnail candidate.",
      prompt,
      notes,
      images,
    });
  } catch (error) {
    console.error("Gemini upload handler failed", error);
    const message =
      error instanceof Error ? error.message : "Unexpected server error while generating the image.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
