"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type HistoryEntry = {
  id: string;
  src: string;
  mimeType: string;
  prompt: string;
  createdAt: number;
  label: string;
};

type UploadResponse = {
  ok: boolean;
  message?: string;
  prompt?: string;
  images?: Array<{ data?: string; mimeType?: string }>;
  notes?: unknown[];
};

const MAX_HISTORY_ITEMS = 12;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file as data URL."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(
  dataUrl: string,
  filename: string,
  fallbackMimeType = "image/png"
): Promise<File> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Failed to convert data URL to file.");
  }
  const blob = await response.blob();
  const mimeType = blob.type || fallbackMimeType;
  return new File([blob], filename, { type: mimeType });
}

function createHistoryEntry(
  src: string,
  mimeType: string,
  prompt: string,
  label: string
): HistoryEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    src,
    mimeType,
    prompt,
    label,
    createdAt: Date.now(),
  };
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [modelNotes, setModelNotes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addHistoryEntries = (entries: HistoryEntry[]) => {
    setHistory((prev) => {
      const dedupedPrev = prev.filter(
        (existing) => !entries.some((entry) => entry.src === existing.src)
      );
      return [...entries, ...dedupedPrev].slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setPreview(null);
      setSelectedFile(null);
      setGeneratedImages([]);
      setModelNotes([]);
      setStatusMessage(null);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);
      setSelectedFile(file);
      setGeneratedImages([]);
      setModelNotes([]);
      setStatusMessage(null);

      addHistoryEntries([
        createHistoryEntry(
          dataUrl,
          file.type || "image/png",
          "",
          file.name ? `Upload: ${file.name}` : "Uploaded image"
        ),
      ]);
    } catch (error) {
      console.error("Failed to read selected file", error);
      setStatusMessage("Could not read the selected file. Please try another image.");
    }
  };

  const handleHistorySelect = async (entry: HistoryEntry) => {
    try {
      setPreview(entry.src);
      const file = await dataUrlToFile(
        entry.src,
        `history-${entry.id}.png`,
        entry.mimeType
      );
      setSelectedFile(file);
      setStatusMessage("Loaded image from history. Adjust your prompt to continue iterating.");
    } catch (error) {
      console.error("Failed to reuse history image", error);
      setStatusMessage("Unable to reuse that history image. Please try another one.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setStatusMessage("Upload a thumbnail before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setGeneratedImages([]);
      setModelNotes([]);
      setStatusMessage("Generating with Gemini...");

      const formData = new FormData();
      formData.append("thumbnail", selectedFile);
      formData.append("instructions", instructions);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => null)) as UploadResponse | null;
      if (!response.ok || !result?.ok) {
        const errorMessage =
          typeof result?.message === "string" && result.message.length > 0
            ? result.message
            : `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      if (!result) {
        setStatusMessage("Gemini returned an empty response.");
        return;
      }

      const parsedImages = Array.isArray(result.images)
        ? result.images
            .map((image, index) => {
              if (!image?.data) {
                return null;
              }
              const mimeType = image.mimeType ?? "image/png";
              const src = `data:${mimeType};base64,${image.data}`;
              return { src, mimeType, index };
            })
            .filter(
              (value): value is { src: string; mimeType: string; index: number } =>
                Boolean(value)
            )
        : [];

      const notes: string[] = Array.isArray(result.notes)
        ? result.notes.filter(
            (note): note is string =>
              typeof note === "string" && note.trim().length > 0
          )
        : [];

      setGeneratedImages(parsedImages.map((image) => image.src));
      setModelNotes(notes);

      if (parsedImages.length > 0) {
        const primary = parsedImages[0];
        setPreview(primary.src);

        const nextFile = await dataUrlToFile(
          primary.src,
          `gemini-output-${Date.now()}.png`,
          primary.mimeType
        );
        setSelectedFile(nextFile);

        addHistoryEntries(
          parsedImages.map((image, index) =>
            createHistoryEntry(
              image.src,
              image.mimeType,
              result.prompt ?? instructions,
              index === 0 ? "Gemini result" : `Gemini variant ${index + 1}`
            )
          )
        );
      }

      setStatusMessage(
        typeof result.message === "string"
          ? result.message
          : "Gemini returned a new thumbnail."
      );
    } catch (error) {
      console.error("Failed to submit form", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center gap-10 p-6">
      <form
        className="flex w-full max-w-[960px] flex-col items-center gap-6"
        onSubmit={handleSubmit}
      >
        <input
          id="thumbnail"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
        <label
          htmlFor="thumbnail"
          className="cursor-pointer rounded-full bg-black text-white px-6 py-3 text-sm font-medium transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Choose Thumbnail
        </label>
        <div className="flex w-full items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Current thumbnail preview"
              className="w-full max-w-[960px] rounded-xl object-contain shadow-lg"
            />
          ) : (
            <div className="flex h-64 w-full max-w-[960px] items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500">
              No image selected yet.
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <label
            htmlFor="instruction-text"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-200"
          >
            Edit instructions
          </label>
          <input
            id="instruction-text"
            type="text"
            placeholder="Describe how you want the thumbnail edited"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white/90 px-4 py-3 text-sm text-neutral-900 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-white dark:focus:ring-white/20"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
          disabled={isSubmitting || !selectedFile}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
        {statusMessage ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 text-center">
            {statusMessage}
          </p>
        ) : null}
        {modelNotes.length > 0 ? (
          <ul className="w-full max-w-[960px] list-disc space-y-1 text-left text-xs text-neutral-500 dark:text-neutral-400">
            {modelNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        ) : null}
      </form>
      {generatedImages.length > 0 ? (
        <div className="w-full max-w-[960px] space-y-4">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            Latest Gemini output
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {generatedImages.map((src, index) => (
              <img
                key={`${src}-${index}`}
                src={src}
                alt={`Gemini generated thumbnail ${index + 1}`}
                className="w-full rounded-xl object-contain shadow-lg"
              />
            ))}
          </div>
        </div>
      ) : null}
      {history.length > 0 ? (
        <div className="w-full max-w-[960px] border-t border-neutral-200/60 dark:border-neutral-700/60 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              History
            </h3>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Tap a thumbnail to reuse it
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleHistorySelect(entry)}
                className="group relative flex-shrink-0 rounded-lg border border-transparent transition hover:border-black/50 dark:hover:border-white/60 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:focus:ring-white"
                title={entry.prompt || entry.label}
                aria-label={`Reuse ${entry.label}`}
              >
                <img
                  src={entry.src}
                  alt={entry.label}
                  className="h-24 w-24 rounded-lg object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
