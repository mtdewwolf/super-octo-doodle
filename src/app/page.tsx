"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
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

type GeneratedImage = {
  id: string;
  src: string;
  mimeType: string;
  label: string;
  fileName: string;
  createdAt: number;
};

type ReferenceImage = {
  id: string;
  file: File;
  preview: string;
  mimeType: string;
  label: string;
};

type UploadResponse = {
  ok: boolean;
  message?: string;
  prompt?: string;
  images?: Array<{ data?: string; mimeType?: string }>;
  notes?: unknown[];
};

type ToastTone = "info" | "success" | "error";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

const MAX_HISTORY_ITEMS = 12;
const MAX_REFERENCE_ITEMS = 3;
const TOAST_DURATION_MS = 3600;

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

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveExtension(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  const parts = mimeType.split("/");
  return parts[1] ?? "png";
}

function createHistoryEntry(
  src: string,
  mimeType: string,
  prompt: string,
  label: string
): HistoryEntry {
  return {
    id: createId(),
    src,
    mimeType,
    prompt,
    label,
    createdAt: Date.now(),
  };
}

function createGeneratedImage(
  src: string,
  mimeType: string,
  index: number,
  label?: string
): GeneratedImage {
  const timeStamp = Date.now();
  const extension = resolveExtension(mimeType);
  return {
    id: createId(),
    src,
    mimeType,
    label: label ?? (index === 0 ? "Primary" : `Variant ${index + 1}`),
    fileName: `gemini-output-${timeStamp}-${index + 1}.${extension}`,
    createdAt: timeStamp,
  };
}

function historyToGenerated(entry: HistoryEntry): GeneratedImage {
  const extension = resolveExtension(entry.mimeType);
  return {
    id: entry.id,
    src: entry.src,
    mimeType: entry.mimeType,
    label: entry.label,
    fileName: `history-${entry.id}.${extension}`,
    createdAt: entry.createdAt,
  };
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [modelNotes, setModelNotes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toastTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      toastTimeoutsRef.current = [];
    };
  }, []);

  const pushToast = (message: string, tone: ToastTone = "info") => {
    const id = createId();
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
    toastTimeoutsRef.current.push(timeoutId);
  };

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
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);
      setSelectedFile(file);
      setGeneratedImages([]);
      setModelNotes([]);

      addHistoryEntries([
        createHistoryEntry(
          dataUrl,
          file.type || "image/png",
          "",
          file.name ? `Upload: ${file.name}` : "Uploaded image"
        ),
      ]);
      pushToast("Uploaded base image.", "success");
    } catch (error) {
      console.error("Failed to read selected file", error);
      pushToast("Could not read the selected file. Please try another image.", "error");
    }
  };

  const handleReferenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const existingCount = referenceImages.length;
    const remainingSlots = MAX_REFERENCE_ITEMS - existingCount;
    if (remainingSlots <= 0) {
      pushToast("You already added the maximum of 3 reference images.", "error");
      return;
    }

    const limitedFiles = files.slice(0, remainingSlots);

    try {
      const newRefs: ReferenceImage[] = [];
      for (const file of limitedFiles) {
        const preview = await readFileAsDataUrl(file);
        newRefs.push({
          id: createId(),
          file,
          preview,
          mimeType: file.type || "image/png",
          label: file.name || `Reference ${referenceImages.length + newRefs.length + 1}`,
        });
      }

      setReferenceImages((prev) => [...prev, ...newRefs]);
      pushToast(`Added ${newRefs.length} reference image${newRefs.length > 1 ? "s" : ""}.`, "success");
    } catch (error) {
      console.error("Failed to add reference image", error);
      pushToast("Unable to read one of the reference images.", "error");
    }
  };

  const handleReferenceRemove = (id: string) => {
    setReferenceImages((prev) => prev.filter((item) => item.id !== id));
    pushToast("Removed reference image.", "info");
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
      pushToast("Loaded history image. Adjust your prompt to keep iterating.", "info");
    } catch (error) {
      console.error("Failed to reuse history image", error);
      pushToast("Unable to reuse that history image. Please try another one.", "error");
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    try {
      const link = document.createElement("a");
      link.href = image.src;
      link.download = image.fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      pushToast(`Downloading ${image.fileName}...`, "info");
    } catch (error) {
      console.error("Failed to download image", error);
      pushToast("Unable to trigger download. Try right-clicking the image instead.", "error");
    }
  };

  const handleShare = async (image: GeneratedImage) => {
    try {
      if (navigator.share) {
        const shareFile = await dataUrlToFile(image.src, image.fileName, image.mimeType);
        const shareData: ShareData = {
          files: [shareFile],
          title: "Super Octo Doodle",
          text: image.label,
        };
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
          pushToast("Shared via system share sheet.", "success");
          return;
        }
      }

      await navigator.clipboard.writeText(image.src);
      pushToast("Copied image data URL to clipboard.", "success");
    } catch (error) {
      console.error("Failed to share image", error);
      pushToast("Could not share automatically. Try manually copying the image.", "error");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      pushToast("Upload a thumbnail before submitting.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      setGeneratedImages([]);
      setModelNotes([]);
      pushToast("Generating with Gemini...", "info");

      const formData = new FormData();
      formData.append("thumbnail", selectedFile);
      formData.append("instructions", instructions);
      referenceImages.forEach((item) => formData.append("references", item.file));

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
        pushToast("Gemini returned an empty response.", "error");
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

      const generatedPayload = parsedImages.map((image, index) =>
        createGeneratedImage(
          image.src,
          image.mimeType,
          index,
          index === 0 ? "Primary" : `Variant ${index + 1}`
        )
      );

      setGeneratedImages(generatedPayload);
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

      pushToast(
        typeof result.message === "string"
          ? result.message
          : "Gemini returned a new thumbnail.",
        "success"
      );
    } catch (error) {
      console.error("Failed to submit form", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      pushToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.2),_transparent_65%)]" aria-hidden="true" />

      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-6 md:justify-end">
        <div className="flex flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto min-w-[260px] max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur transition ${
                toast.tone === "success"
                  ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-50"
                  : toast.tone === "error"
                  ? "border-rose-400/50 bg-rose-500/20 text-rose-50"
                  : "border-white/30 bg-white/20 text-white"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>

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
              Choose Base Image
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
                  No base image selected yet.
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-100">
                    Reference images (style transfer / composition)
                  </p>
                  <span className="text-xs text-white/60">
                    Up to {MAX_REFERENCE_ITEMS} images
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <input
                    id="reference-images"
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleReferenceChange}
                  />
                  <label
                    htmlFor="reference-images"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-black/20 backdrop-blur hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    Add Reference Images
                  </label>
                </div>
                {referenceImages.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {referenceImages.map((item) => (
                      <div
                        key={item.id}
                        className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-lg"
                      >
                        <img
                          src={item.preview}
                          alt={item.label}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleReferenceRemove(item.id)}
                          className="absolute right-1 top-1 rounded-full border border-white/40 bg-black/50 px-2 text-[10px] font-semibold text-white hover:bg-black/70"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/60">
                    Optional: add style or reference images to guide Gemini.
                  </p>
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
            </div>

            <button
              type="submit"
              className="rounded-full border border-white/40 bg-gradient-to-r from-cyan-400/80 via-sky-500/80 to-violet-500/80 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:from-cyan-300/90 hover:via-sky-400/90 hover:to-violet-400/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !selectedFile}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
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
            <div className="flex flex-col items-center gap-6">
              {generatedImages.map((image) => (
                <div
                  key={image.id}
                  className="flex w-full max-w-[520px] flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg"
                >
                  <img
                    src={image.src}
                    alt={`Gemini generated thumbnail ${image.label}`}
                    className="w-full rounded-2xl object-contain"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-wide text-white/70">
                    <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1">
                      {image.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(image)}
                      className="rounded-full border border-white/30 bg-white/20 px-4 py-1 font-semibold text-white shadow-md shadow-black/20 transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(image)}
                      className="rounded-full border border-white/30 bg-white/20 px-4 py-1 font-semibold text-white shadow-md shadow-black/20 transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      Share Link
                    </button>
                  </div>
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
              {history.map((entry) => {
                const historyImage = historyToGenerated(entry);
                return (
                  <div
                    key={entry.id}
                    className="group relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:border-white/40"
                  >
                    <button
                      type="button"
                      onClick={() => handleHistorySelect(entry)}
                      className="block"
                      title={entry.prompt || entry.label}
                      aria-label={`Reuse ${entry.label}`}
                    >
                      <img
                        src={entry.src}
                        alt={entry.label}
                        className="h-24 w-24 object-cover opacity-90 transition group-hover:opacity-100"
                      />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-black/45 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80">
                      <span>{entry.label}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownload(historyImage)}
                          className="rounded-full border border-white/40 bg-white/20 px-2 py-[2px] text-[9px] font-semibold text-white transition hover:bg-white/40"
                        >
                          DL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(historyImage)}
                          className="rounded-full border border-white/40 bg-white/20 px-2 py-[2px] text-[9px] font-semibold text-white transition hover:bg-white/40"
                        >
                          Share
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

