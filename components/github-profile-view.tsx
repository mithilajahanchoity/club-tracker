"use client";

import { useState, useMemo } from "react";
import type { GitHubPublicProfile } from "@/lib/github";

interface GitHubProfileViewProps {
  profile: GitHubPublicProfile;
  profileId?: string;
}

const monthsShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function GitHubProfileView({ profile }: GitHubProfileViewProps) {
  // Available years from yearlyContributions or default
  const yearsList = useMemo(() => {
    const list = Object.keys(profile.yearlyContributions).sort((a, b) => b.localeCompare(a));
    if (list.length === 0) {
      list.push("2026", "2025", "2024");
    }
    return list;
  }, [profile.yearlyContributions]);

  const [selectedYear, setSelectedYear] = useState<string>(
    yearsList[0] || "2026"
  );

  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // 52-Week Grid for the Selected Year / Rolling View
  const { weeks, monthHeaders } = useMemo(() => {
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 3600000);
    const todayString = bdNow.toISOString().slice(0, 10);

    let startMs: number;
    let endMs: number;
    const totalWeeks = 53;

    if (selectedYear === "2026" || selectedYear === String(bdNow.getUTCFullYear())) {
      // Rolling 52-week view ending today (matches screenshot with Nov, Dec, Jan... Oct)
      const dayOfWeek = (bdNow.getUTCDay() + 6) % 7;
      const daysUntilSunday = 6 - dayOfWeek;
      endMs = bdNow.getTime() + daysUntilSunday * 86400000;
      startMs = endMs - (totalWeeks * 7 - 1) * 86400000;
    } else {
      // Calendar year (Jan 1 to Dec 31)
      const yr = parseInt(selectedYear, 10);
      const startOfYear = new Date(Date.UTC(yr, 0, 1));
      const dayOfWeek = (startOfYear.getUTCDay() + 6) % 7;
      startMs = startOfYear.getTime() - dayOfWeek * 86400000;
      endMs = startMs + (totalWeeks * 7 - 1) * 86400000;
    }

    const weeksArr: Array<
      Array<{
        date: string;
        count: number;
        isFuture: boolean;
      }>
    > = [];

    const headers: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays: Array<{
        date: string;
        count: number;
        isFuture: boolean;
      }> = [];

      for (let d = 0; d < 7; d++) {
        const curMs = startMs + (w * 7 + d) * 86400000;
        const curDate = new Date(curMs);
        const curDateStr = curDate.toISOString().slice(0, 10);
        const count = profile.activityMap[curDateStr] ?? 0;
        const isFuture = curDateStr > todayString;

        weekDays.push({
          date: curDateStr,
          count,
          isFuture,
        });

        if (d === 0) {
          const m = curDate.getUTCMonth();
          if (m !== lastMonth) {
            headers.push({ weekIndex: w, label: monthsShort[m] });
            lastMonth = m;
          }
        }
      }
      weeksArr.push(weekDays);
    }

    return { weeks: weeksArr, monthHeaders: headers };
  }, [profile.activityMap, selectedYear]);

  // Color Scale for GitHub Contribution Squares (Exact GitHub dark theme colors)
  const getGitHubCellColor = (count: number, isFuture: boolean) => {
    if (isFuture) return "bg-transparent opacity-0 pointer-events-none";
    if (count === 0) return "bg-[#161b22] border border-[#21262d]";
    if (count <= 2) return "bg-[#0e4429] border border-[#006d32]/40";
    if (count <= 5) return "bg-[#006d32] border border-[#26a641]/50";
    if (count <= 9) return "bg-[#26a641] border border-[#39d353]/60";
    return "bg-[#39d353] border border-[#39d353]"; // Bright lime green
  };

  const currentYearContributions =
    selectedYear === "2026"
      ? profile.totalContributionsLastYear
      : profile.yearlyContributions[selectedYear] ?? 0;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP SECTION: Activity Heatmap & Year-wise Selector (Matches Screenshot 2)
         ========================================================================= */}
      <section className="space-y-3">
        {!profile.isActivityPublic ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-foreground shadow-sm dark:border-[#30363d] dark:bg-[#0d1117] dark:text-[#c9d1d9]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-[#161b22] dark:border dark:border-[#30363d]">
              🔒
            </div>
            <h3 className="text-base font-semibold text-foreground dark:text-[#f0f6fc]">
              The Users Activity is hidden
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground dark:text-[#8b949e]">
              This member&apos;s contribution activity is not public or has been set to private on GitHub.
            </p>
          </div>
        ) : (
          <>
            {/* Header row: count on left, settings on right */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground dark:text-[#f0f6fc]">
                {currentYearContributions} contributions in{" "}
                {selectedYear === "2026" ? "the last year" : selectedYear}
              </h2>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-[#8b949e]">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-[#c9d1d9] transition-colors"
                >
                  <span>Contribution settings</span>
                  <span className="text-[10px]">▼</span>
                </button>
              </div>
            </div>

            {/* Heatmap Box + Right Year Sidebar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {/* Main Heatmap Container (Dark GitHub Theme) */}
              <div className="flex-1 rounded-xl border border-[#30363d] bg-[#0d1117] p-4 text-[#c9d1d9] shadow-sm md:p-5">
                <div className="relative overflow-x-auto pb-2">
                  <div className="min-w-[760px] select-none">
                    {/* Month Headers */}
                    <div className="flex text-[11px] font-medium text-[#8b949e] mb-1.5 pl-9">
                      {weeks.map((_, wIdx) => {
                        const header = monthHeaders.find((m) => m.weekIndex === wIdx);
                        return (
                          <div key={wIdx} className="w-[14px] text-left">
                            {header ? header.label : ""}
                          </div>
                        );
                      })}
                    </div>

                    {/* Days Column + 52 Weeks */}
                    <div className="flex items-start">
                      {/* Day Labels on Left (Mon, Wed, Fri like in screenshot) */}
                      <div className="flex flex-col justify-between text-[10px] font-medium text-[#8b949e] pr-2 w-9 h-[95px] py-0.5">
                        <span>Mon</span>
                        <span className="text-transparent select-none">Tue</span>
                        <span>Wed</span>
                        <span className="text-transparent select-none">Thu</span>
                        <span>Fri</span>
                        <span className="text-transparent select-none">Sat</span>
                        <span className="text-transparent select-none">Sun</span>
                      </div>

                      {/* 52 Columns of 7 Squares */}
                      <div className="flex gap-[3px]">
                        {weeks.map((week, wIdx) => (
                          <div key={wIdx} className="flex flex-col gap-[3px]">
                            {week.map((day) => (
                              <div
                                key={day.date}
                                className={`h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 cursor-pointer ${getGitHubCellColor(
                                  day.count,
                                  day.isFuture
                                )}`}
                                onMouseEnter={(e) => {
                                  if (day.isFuture) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredCell({
                                    date: day.date,
                                    count: day.count,
                                    x: rect.left,
                                    y: rect.top,
                                  });
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cell Tooltip */}
                    {hoveredCell && (
                      <div
                        className="fixed z-50 rounded bg-[#1f242c] px-2.5 py-1 text-xs font-medium text-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full mb-1 border border-[#30363d]"
                        style={{
                          left: `${hoveredCell.x + 6}px`,
                          top: `${hoveredCell.y - 4}px`,
                        }}
                      >
                        {hoveredCell.count > 0
                          ? `${hoveredCell.count} ${hoveredCell.count === 1 ? "contribution" : "contributions"} on ${hoveredCell.date}`
                          : `No contributions on ${hoveredCell.date}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Footer inside Heatmap Box */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#21262d] pt-3 text-xs text-[#8b949e]">
                  <a
                    href="https://docs.github.com/articles/why-are-my-contributions-not-showing-up-on-my-profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#58a6ff] hover:underline transition-colors"
                  >
                    Learn how we count contributions
                  </a>

                  {/* Legend: Less -> More */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span>Less</span>
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#161b22] border border-[#21262d]" />
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#0e4429]" />
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#006d32]" />
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#26a641]" />
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#39d353]" />
                    <span>More</span>
                  </div>
                </div>
              </div>

              {/* Right: Year-wise Tabs Sidebar (Matches Screenshot 2) */}
              <div className="flex shrink-0 flex-row gap-1.5 lg:flex-col lg:w-28">
                {yearsList.map((yr) => {
                  const isActive = selectedYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all text-center ${
                        isActive
                          ? "bg-[#1f6feb] text-white shadow-xs"
                          : "text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] dark:hover:bg-zinc-800"
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      {/* =========================================================================
          BOTTOM SECTION: Public Repositories Grid (Matches Screenshot 1)
         ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Public Repositories
            </h3>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {profile.publicRepos.length}
            </span>
          </div>

          <a
            href={`https://github.com/${profile.handle}?tab=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline font-medium"
          >
            View all on GitHub ↗
          </a>
        </div>

        {/* Public Repos Grid */}
        {profile.publicRepos.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {profile.publicRepos.map((repo) => (
              <div
                key={repo.name}
                className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-card p-4 text-card-foreground shadow-xs transition-colors hover:border-zinc-400 dark:border-[#30363d] dark:bg-[#0d1117] dark:hover:border-[#58a6ff]/60"
              >
                {/* Header: Name + Public Badge + Star Button */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-[#0969da] hover:underline dark:text-[#58a6ff] transition-colors break-all"
                      >
                        {repo.name}
                      </a>
                      <span className="rounded-full border border-zinc-300 dark:border-[#30363d] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:text-[#8b949e] leading-none">
                        Public
                      </span>
                    </div>

                    {/* Star Button (Matches Screenshot) */}
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-[#30363d] bg-zinc-100 dark:bg-[#21262d] px-2.5 py-1 text-xs font-medium text-foreground dark:text-[#c9d1d9] transition-colors hover:bg-zinc-200 dark:hover:bg-[#30363d]"
                    >
                      <span className="text-zinc-500 dark:text-[#8b949e]">☆</span>
                      <span>Star</span>
                    </a>
                  </div>

                  {/* Description (if present) */}
                  {repo.description && (
                    <p className="mt-2 text-xs text-muted-foreground dark:text-[#8b949e] line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                </div>

                {/* Footer: Language dot & name + Updated date */}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/40 dark:border-[#21262d] pt-3 text-xs text-muted-foreground dark:text-[#8b949e]">
                  {/* Language */}
                  {repo.language && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: repo.languageColor }}
                      />
                      <span className="font-medium text-foreground dark:text-[#c9d1d9]">
                        {repo.language}
                      </span>
                    </div>
                  )}

                  {/* Updated Date */}
                  <span>{repo.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No public repositories found for @{profile.handle}.
          </div>
        )}
      </section>
    </div>
  );
}

