"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!file) {
      setPreview(null);
      setSelectedFile(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setSelectedFile(file);
    setStatusMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setStatusMessage("Upload a thumbnail before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const formData = new FormData();
      formData.append("thumbnail", selectedFile);
      formData.append("instructions", instructions);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }

      await response.json();
      setStatusMessage("Upload submitted successfully.");
    } catch (error) {
      console.error("Failed to submit form", error);
      setStatusMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
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
              alt="Uploaded thumbnail preview"
              className="w-full max-w-[960px] rounded-xl object-contain shadow-lg"
            />
          ) : (
            <div className="flex h-64 w-full max-w-[960px] items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500">
              No image selected yet.
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <label htmlFor="instruction-text" className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
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
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{statusMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
