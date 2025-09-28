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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.2),_transparent_65%)]" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-12 px-6 py-12">
        <form
          className="relative w-full max-w-[960px] rounded-3xl border border-white/10 bg-white/10 px-8 py-10 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl"
          onSubmit={handleSubmit}
        >
          <div className="flex w-full flex-col items-center gap-6">
            <input
              id="thumbnail"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
            <label
              htmlFor="thumbnail"
              className="rounded-full border border-white/30 bg-white/20 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 backdrop-blur hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Choose Thumbnail
            </label>
            <div className="flex w-full items-center justify-center">
              {preview ? (
                <img
                  src={preview}
                  alt="Current thumbnail preview"
                  className="w-full max-w-[880px] rounded-3xl border border-white/10 bg-white/5 object-contain shadow-2xl"
                />
              ) : (
                <div className="flex h-64 w-full max-w-[880px] items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 text-sm text-slate-200/80 backdrop-blur">
                  No image selected yet.
                </div>
              )}
            </div>
            <div className="flex w-full flex-col gap-2">
              <label
                htmlFor="instruction-text"
                className="text-sm font-medium text-slate-200"
              >
                Edit instructions
              </label>
              <input
                id="instruction-text"
                type="text"
                placeholder="Describe how you want the thumbnail edited"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/60 shadow-inner shadow-black/10 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
            <button
              type="submit"
              className="rounded-full border border-white/40 bg-gradient-to-r from-cyan-400/80 via-sky-500/80 to-violet-500/80 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:from-cyan-300/90 hover:via-sky-400/90 hover:to-violet-400/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !selectedFile}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
            {statusMessage ? (
              <p className="text-sm text-slate-100/80 text-center">
                {statusMessage}
              </p>
            ) : null}
            {modelNotes.length > 0 ? (
              <ul className="w-full max-w-[880px] list-disc space-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-slate-200/80 backdrop-blur">
                {modelNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        {generatedImages.length > 0 ? (
          <div className="w-full max-w-[960px] rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Latest Gemini output
              </h2>
              <span className="text-xs text-slate-200/70">
                Primary result becomes the next editable image automatically
              </span>
            </div>
            <div className="flex flex-col items-center">
              {generatedImages.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="mb-6 flex w-full max-w-[520px] justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-lg last:mb-0"
                >
                  <img
                    src={src}
                    alt={`Gemini generated thumbnail ${index + 1}`}
                    className="w-full rounded-2xl object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="w-full max-w-[960px] rounded-3xl border border-white/10 bg-white/10 px-6 py-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                History
              </h3>
              <span className="text-xs text-slate-200/70">
                Tap a thumbnail to reuse it
              </span>
            </div>
            <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleHistorySelect(entry)}
                  className="group relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white"
                  title={entry.prompt || entry.label}
                  aria-label={`Reuse ${entry.label}`}
                >
                  <img
                    src={entry.src}
                    alt={entry.label}
                    className="h-24 w-24 object-cover opacity-90 transition group-hover:opacity-100"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/80">
                    {entry.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
