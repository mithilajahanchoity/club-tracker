"use client";

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/format";
import { PlatformIcon } from "./platform-icon";

export type ContestItem = {
  contest_name: string;
  platform: string;
  contest_date: string; // ISO date e.g. "YYYY-MM-DD"
  rank: number | null;
  rating_change: number | null;
  new_rating?: number | null;
  url?: string | null;
};

interface ContestParticipationTableProps {
  contests: ContestItem[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  showPlatform?: boolean;
  initialLimit?: number;
}

const platformLabels: Record<string, string> = {
  codeforces: "Codeforces",
  codechef: "CodeChef",
  vjudge: "VJudge",
  beecrowd: "Beecrowd",
  hackerrank: "HackerRank",
  github: "GitHub",
};

export function ContestParticipationTable({
  contests,
  title = "Contest Participation",
  subtitle = "Official rated contests recorded for this member",
  emptyMessage = "No rated contest participations recorded.",
  showPlatform = true,
  initialLimit = 15,
}: ContestParticipationTableProps) {
  const [showAll, setShowAll] = useState(false);

  // Ensure all contests are sorted chronologically by date descending (newest first)
  const sortedContests = useMemo(() => {
    return [...contests].sort((a, b) => {
      const dateA = a.contest_date?.slice(0, 10) || "";
      const dateB = b.contest_date?.slice(0, 10) || "";
      return dateB.localeCompare(dateA);
    });
  }, [contests]);

  const displayedContests = showAll
    ? sortedContests
    : sortedContests.slice(0, initialLimit);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="border-b border-border pb-3">
        <h2 className="font-semibold text-base tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      {sortedContests.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 font-medium">Contest</th>
                {showPlatform && <th className="pb-2 font-medium">Platform</th>}
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Rank</th>
                <th className="pb-2 font-medium text-right">Rating Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedContests.map((c, i) => (
                <tr key={`${c.platform}-${c.contest_name}-${c.contest_date}-${i}`} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 font-medium pr-3">
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:underline inline-flex items-center gap-1"
                      >
                        <span>{c.contest_name}</span>
                        <span className="text-[10px] text-muted-foreground opacity-70">↗</span>
                      </a>
                    ) : (
                      <span className="text-foreground">{c.contest_name}</span>
                    )}
                  </td>
                  {showPlatform && (
                    <td className="py-2.5 whitespace-nowrap pr-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 shrink-0" />
                        <span className="capitalize text-foreground/90 font-medium">
                          {platformLabels[c.platform] ?? c.platform}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="py-2.5 text-muted-foreground whitespace-nowrap pr-3">
                    {formatDate(c.contest_date)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap pr-3">
                    {c.rank != null ? `#${c.rank.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold whitespace-nowrap">
                    {c.rating_change != null ? (
                      <span
                        className={
                          c.rating_change >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {c.rating_change > 0
                          ? `+${c.rating_change}`
                          : c.rating_change}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-normal">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedContests.length > initialLimit && (
            <div className="mt-3 flex justify-center border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted"
              >
                {showAll
                  ? "Show less ↑"
                  : `Show all ${sortedContests.length} contests (${sortedContests.length - initialLimit} more) ↓`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

