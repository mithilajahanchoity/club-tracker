"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncPlatformAccountAction } from "@/app/actions/sync";

interface SyncPlatformButtonProps {
  profileId: string;
  platform: string;
  platformName?: string;
  className?: string;
  size?: "sm" | "default";
}

export function SyncPlatformButton({
  profileId,
  platform,
  platformName,
  className = "",
  size = "sm",
}: SyncPlatformButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSync(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await syncPlatformAccountAction(profileId, platform);
      if (res.success) {
        setFeedback({ type: "success", text: res.message });
        router.refresh();
      } else {
        setFeedback({ type: "error", text: res.message || res.error || "Sync failed" });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Sync failed";
      setFeedback({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
      // Auto-clear feedback after 6 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 6000);
    }
  }

  const isSmall = size === "sm";

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        title={`Sync ${platformName ?? platform} activity now`}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border font-medium transition-all hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-60 ${
          isSmall ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs"
        } ${loading ? "bg-muted text-muted-foreground" : "bg-background text-foreground shadow-sm"} ${className}`}
      >
        <span className={`inline-block text-xs ${loading ? "animate-spin" : ""}`}>
          🔄
        </span>
        <span>{loading ? "Syncing..." : "Sync"}</span>
      </button>

      {/* Floating feedback message */}
      {feedback && (
        <div
          role="status"
          className={`absolute bottom-full mb-1.5 right-0 z-30 max-w-xs whitespace-normal rounded-xl border p-2.5 text-[11px] shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20"
          }`}
        >
          <div className="flex items-start gap-1.5">
            <span className="font-bold">{feedback.type === "success" ? "✓" : "⚠"}</span>
            <span className="leading-snug">{feedback.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

