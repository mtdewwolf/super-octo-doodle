import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolvePrompt() {
  const cliPrompt = process.argv.slice(2).join(" ").trim();
  if (cliPrompt.length > 0) {
    return cliPrompt;
  }

  const envPrompt = process.env.GEMINI_PROMPT?.trim();
  if (envPrompt) {
    return envPrompt;
  }

  throw new Error(
    "No prompt provided. Pass it as CLI arguments or set GEMINI_PROMPT in your environment."
  );
}

function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(
        `Unsupported image format for '${filePath}'. Use PNG, JPG, or WEBP.`
      );
  }
}

async function loadSeedImage(seedPath) {
  if (!seedPath) {
    return null;
  }

  const absolutePath = path.isAbsolute(seedPath)
    ? seedPath
    : path.join(process.cwd(), seedPath);

  const fileContents = await fs.readFile(absolutePath);
  const mimeType = detectMimeType(absolutePath);

  return {
    inlineData: {
      mimeType,
      data: fileContents.toString("base64"),
    },
    description: absolutePath,
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  try {
    const apiKey = requireEnv("GEMINI_API_KEY");
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image-preview";
    const prompt = resolvePrompt();
    const seedImagePath = process.env.GEMINI_SEED_IMAGE_PATH || "";

    const seed = await loadSeedImage(seedImagePath.trim() || null);

    const ai = new GoogleGenAI({ apiKey });

    const parts = [{ text: prompt }];
    if (seed) {
      parts.push({ inlineData: seed.inlineData });
      console.log(`Loaded seed image: ${seed.description}`);
    } else {
      console.log("No seed image configured. Running in text-to-image mode.");
    }

    console.log(`Generating with model '${model}'...`);

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates returned by Gemini.");
    }

    const outputDir = path.join(process.cwd(), "outputs");
    await ensureDir(outputDir);

    let imageCount = 0;
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        console.log(`Model message: ${part.text}`);
      }

      if (part.inlineData?.data) {
        imageCount += 1;
        const mimeType = part.inlineData.mimeType || "image/png";
        const extension =
          mimeType === "image/png"
            ? "png"
            : mimeType === "image/jpeg"
            ? "jpg"
            : mimeType === "image/webp"
            ? "webp"
            : "bin";
        const filename = path.join(
          outputDir,
          `gemini-output-${Date.now()}-${imageCount}.${extension}`
        );
        const buffer = Buffer.from(part.inlineData.data, "base64");
        await fs.writeFile(filename, buffer);
        console.log(`Saved image #${imageCount} to ${filename}`);
      }
    }

    if (imageCount === 0) {
      console.warn("Gemini did not return any inline image data.");
    }
  } catch (error) {
    console.error("Gemini image generation failed:", error.message || error);
    process.exitCode = 1;
  }
}

await main();
