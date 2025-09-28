"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type AnalysisResponse = {
  ok: boolean;
  problem?: string;
  message?: string;
};

type SolveResponse = {
  ok: boolean;
  answer?: string;
  explanation?: string;
  message?: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file preview."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function MathPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [solution, setSolution] = useState<{ answer: string; explanation: string } | null>(null);

  const canAnalyze = useMemo(() => Boolean(selectedFile) && !isAnalyzing, [selectedFile, isAnalyzing]);
  const canSolve = useMemo(
    () => analysisText.trim().length > 0 && !isSolving,
    [analysisText, isSolving]
  );

  const resetWorkflow = () => {
    setAnalysisText("");
    setAnalysisError(null);
    setIsAnalyzing(false);
    setIsSolving(false);
    setSolveError(null);
    setSolution(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      resetWorkflow();
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedFile(file);
      setPreview(dataUrl);
      resetWorkflow();
    } catch (error) {
      console.error("Failed to prepare preview", error);
      setAnalysisError("Could not preview that file. Try another image.");
      setSelectedFile(null);
      setPreview(null);
    }
  };

  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !canAnalyze) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSolveError(null);
    setSolution(null);

    try {
      const formData = new FormData();
      formData.append("problemImage", selectedFile);

      const response = await fetch("/api/math/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as AnalysisResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Gemini could not read that image.");
      }

      if (!payload || !payload.ok || !payload.problem) {
        throw new Error(payload?.message ?? "Gemini did not return the math problem text.");
      }

      setAnalysisText(payload.problem.trim());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while analyzing the image.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSolve = async () => {
    if (!canSolve) {
      return;
    }

    setIsSolving(true);
    setSolveError(null);

    try {
      const response = await fetch("/api/math/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ problem: analysisText.trim() }),
      });

      const payload = (await response.json().catch(() => null)) as SolveResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Gemini could not solve the problem.");
      }

      if (!payload || !payload.ok || !payload.answer || !payload.explanation) {
        throw new Error(payload?.message ?? "Gemini did not return a full solution.");
      }

      setSolution({
        answer: payload.answer.trim(),
        explanation: payload.explanation.trim(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while solving the problem.";
      setSolveError(message);
    } finally {
      setIsSolving(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    resetWorkflow();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_65%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 px-6 py-5 shadow-xl backdrop-blur">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Gemini 2.5
            </p>
            <h1 className="text-2xl font-semibold text-white">Math Problem Interpreter</h1>
            <p className="text-sm text-white/70">
              Upload a math problem, confirm Gemini read it correctly, then get a worked solution.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/50 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Start Over
          </button>
        </header>

        <form
          onSubmit={handleAnalyze}
          className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex w-full flex-col items-center gap-4 lg:w-1/2">
              <div className="w-full">
                <p className="text-sm font-medium text-white">Problem image</p>
                <p className="text-xs text-white/60">Accepted formats: PNG, JPG, or WEBP.</p>
              </div>
              <div className="flex w-full items-center justify-center">
                {preview ? (
                  <img
                    src={preview}
                    alt="Uploaded problem"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 object-contain shadow-xl"
                  />
                ) : (
                  <div className="flex h-60 w-full items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-sm text-white/60">
                    No image selected yet.
                  </div>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center justify-center gap-3">
                <input
                  id="math-problem"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="math-problem"
                  className="rounded-full border border-white/40 bg-white/20 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Choose Image
                </label>
                {selectedFile ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/50 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-4 lg:w-1/2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-white">Gemini transcription</p>
                <p className="text-xs text-white/60">
                  Gemini reads the problem first. Edit the text if anything looks off before asking for a solution.
                </p>
              </div>
              <textarea
                value={analysisText}
                onChange={(event) => setAnalysisText(event.target.value)}
                placeholder="Your problem will appear here after analysis."
                rows={10}
                className="w-full resize-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/50 shadow-inner shadow-black/20 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                spellCheck={false}
              />
              {analysisError ? (
                <p className="text-xs font-semibold text-rose-200/90">{analysisError}</p>
              ) : (
                <p className="text-xs text-white/60">
                  When you press Solve you confirm the transcription is accurate.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="submit"
              className="rounded-full border border-white/40 bg-gradient-to-r from-emerald-400/80 via-teal-500/80 to-sky-500/80 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-black/20 transition hover:from-emerald-300/90 hover:via-teal-400/90 hover:to-sky-400/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canAnalyze}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Problem"}
            </button>

            <button
              type="button"
              onClick={handleSolve}
              className="rounded-full border border-white/40 bg-gradient-to-r from-cyan-400/80 via-sky-500/80 to-violet-500/80 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-black/20 transition hover:from-cyan-300/90 hover:via-sky-400/90 hover:to-violet-400/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSolve}
            >
              {isSolving ? "Solving..." : "Solve Problem"}
            </button>
          </div>
        </form>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl">
          <h2 className="text-lg font-semibold text-white">Solution walkthrough</h2>
          {solveError ? (
            <p className="text-sm font-semibold text-rose-200/90">{solveError}</p>
          ) : solution ? (
            <div className="space-y-4 text-sm text-white/90">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Final answer</p>
                <p className="mt-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                  {solution.answer}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Step-by-step explanation
                </p>
                <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                  {solution.explanation}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">
              Once you confirm the transcription, Gemini will calculate the answer and explain every step here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}