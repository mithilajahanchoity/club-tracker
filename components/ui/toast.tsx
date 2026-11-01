"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let globalSetToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;
let counter = 0;

export function toast(message: string, type: ToastType = "info") {
  if (globalSetToasts) {
    const id = ++counter;
    globalSetToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      globalSetToasts?.((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    globalSetToasts = setToasts;
    return () => { globalSetToasts = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all ${
            t.type === "success"
              ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
              : t.type === "error"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-border bg-background text-foreground"
          }`}
        >
          <span>
            {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
