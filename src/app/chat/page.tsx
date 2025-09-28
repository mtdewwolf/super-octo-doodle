"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "model";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type ChatResponse = {
  ok: boolean;
  response?: {
    role: ChatRole;
    content: string;
  };
  message?: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "model",
  content:
    "Hey! I'm Gemini 2.5. I'm here to brainstorm Nano Banana ideas, product strategy, marketing angles, or anything else you want to explore.",
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isLoading, [inputValue, isLoading]);

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      if (canSend) {
        formRef.current?.requestSubmit();
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const userContent = inputValue.trim();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: userContent,
    };

    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInputValue("");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as ChatResponse | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Gemini chat request failed.");
      }

      if (!payload || !payload.ok || !payload.response) {
        throw new Error(payload?.message ?? "Gemini did not return a reply.");
      }

      const assistantMessage = payload.response;

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: assistantMessage.role,
          content: assistantMessage.content,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error while talking to Gemini.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setInputValue("");
    setErrorMessage(null);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),_transparent_65%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-6 py-5 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Gemini 2.5</p>
            <h1 className="text-2xl font-semibold text-white">Conversational Chat</h1>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/50 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            disabled={messages.length === 1 && !errorMessage}
          >
            Reset
          </button>
        </header>

        <div className="relative flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl">
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg transition ${
                    message.role === "user"
                      ? "border border-cyan-300/40 bg-cyan-400/90 text-slate-950"
                      : "border border-white/20 bg-white/10 text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="border-t border-white/10 bg-black/20 px-6 py-4 backdrop-blur">
            <form ref={formRef} className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Ask Gemini about Nano Banana ideas, design tweaks, or planning."
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/60 shadow-inner shadow-black/20 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                disabled={isLoading}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {errorMessage ? (
                  <p className="text-xs font-medium text-rose-200/90">{errorMessage}</p>
                ) : (
                  <p className="text-xs text-white/60">Press Shift+Enter for a new line. Messages stay in this browser only.</p>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-gradient-to-r from-cyan-400/80 via-sky-500/80 to-violet-500/80 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-black/20 transition hover:from-cyan-300/90 hover:via-sky-400/90 hover:to-violet-400/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canSend}
                >
                  {isLoading ? "Thinking..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}