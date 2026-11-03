"use client";

import { useState, useMemo } from "react";
import { formatDateTime, formatDate } from "@/lib/format";
import { BeecrowdProfileView } from "./beecrowd-profile-view";
import { CodeforcesProfileView } from "./codeforces-profile-view";
import { VJudgeProfileView } from "./vjudge-profile-view";
import { GitHubProfileView } from "./github-profile-view";
import { CodeChefProfileView } from "./codechef-profile-view";
import { PlatformIcon } from "./platform-icon";
import type { BeecrowdPublicProfile } from "@/lib/beecrowd";
import type { CodeforcesPublicProfile } from "@/lib/codeforces";
import type { VJudgePublicProfile } from "@/lib/vjudge";
import type { GitHubPublicProfile } from "@/lib/github";
import type { CodeChefPublicProfile } from "@/lib/codechef";

export type PlatformAccount = {
  platform: string;
  handle: string;
  verified: boolean;
  last_synced_at: string | null;
};

export type DailyActivity = {
  platform: string;
  activity_date: string;
  solved: number;
  commits: number;
  rating: number | null;
};

export type ContestParticipation = {
  platform: string;
  contest_name: string;
  contest_date: string;
  rank: number | null;
  rating_change: number | null;
};

interface MemberPlatformStatsProps {
  accounts: PlatformAccount[];
  activity: DailyActivity[];
  contests: ContestParticipation[];
  initialPlatform?: string;
  beecrowdDetails?: BeecrowdPublicProfile | null;
  codeforcesDetails?: CodeforcesPublicProfile | null;
  vjudgeDetails?: VJudgePublicProfile | null;
  githubDetails?: GitHubPublicProfile | null;
  codechefDetails?: CodeChefPublicProfile | null;
  profileId?: string;
}

const platformIcons: Record<string, string> = {
  all: "🌐",
  codeforces: "⚡",
  hackerrank: "💻",
  beecrowd: "🐝",
  github: "🐙",
  codechef: "🍳",
  vjudge: "⚖",
};

const platformLabels: Record<string, string> = {
  all: "All Platforms",
  codeforces: "Codeforces",
  hackerrank: "HackerRank",
  beecrowd: "Beecrowd",
  github: "GitHub",
  codechef: "CodeChef",
  vjudge: "VJudge",
};

const platformUrls: Record<string, (handle: string) => string> = {
  codeforces: (h) => `https://codeforces.com/profile/${h}`,
  hackerrank: (h) => `https://www.hackerrank.com/profile/${h}`,
  beecrowd: (h) => `https://judge.beecrowd.com/en/profile/${h}`,
  github: (h) => `https://github.com/${h}`,
  codechef: (h) => `https://www.codechef.com/users/${h}`,
  vjudge: (h) => `https://vjudge.net/user/${h}`,
};

const monthsShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function MemberPlatformStats({
  accounts,
  activity,
  contests,
  initialPlatform = "all",
  beecrowdDetails,
  codeforcesDetails,
  vjudgeDetails,
  githubDetails,
  codechefDetails,
  profileId,
}: MemberPlatformStatsProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>(initialPlatform);
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    solved: number;
    commits: number;
    x: number;
    y: number;
  } | null>(null);

  // Available platform keys (only platforms the member has handles for + "all")
  const availablePlatforms = useMemo(() => {
    const list = ["all"];
    for (const a of accounts) {
      if (!list.includes(a.platform)) list.push(a.platform);
    }
    return list;
  }, [accounts]);

  const activeAccount = useMemo(() => {
    if (selectedPlatform === "all") return null;
    return accounts.find((a) => a.platform === selectedPlatform) ?? null;
  }, [accounts, selectedPlatform]);

  // Filter activity based on selected platform
  const filteredActivity = useMemo(() => {
    if (selectedPlatform === "all") return activity;
    return activity.filter((a) => a.platform === selectedPlatform);
  }, [activity, selectedPlatform]);

  // Filter contests based on selected platform
  const filteredContests = useMemo(() => {
    if (selectedPlatform === "all") return contests;
    return contests.filter((c) => c.platform === selectedPlatform);
  }, [contests, selectedPlatform]);

  // Map activity by date
  const dateActivityMap = useMemo(() => {
    const map = new Map<string, { solved: number; commits: number; rating: number | null }>();
    for (const row of filteredActivity) {
      const prev = map.get(row.activity_date) ?? { solved: 0, commits: 0, rating: null };
      prev.solved += row.solved || 0;
      prev.commits += row.commits || 0;
      if (row.rating != null) prev.rating = row.rating;
      map.set(row.activity_date, prev);
    }
    return map;
  }, [filteredActivity]);

  // Calculate the 52-week heatmap grid aligned by week (Mon-Sun)
  const { weeks, monthLabels, todayStr } = useMemo(() => {
    const now = new Date();
    // Use Bangladesh time offset (UTC+6)
    const bdNow = new Date(now.getTime() + 6 * 3600000);
    const todayString = bdNow.toISOString().slice(0, 10);

    // Day of week in Monday=0 ... Sunday=6
    const dayOfWeek = (bdNow.getUTCDay() + 6) % 7;
    const daysUntilSunday = 6 - dayOfWeek;
    const endMs = bdNow.getTime() + daysUntilSunday * 86400000;

    const totalWeeks = 52;
    const startMs = endMs - (totalWeeks * 7 - 1) * 86400000;

    const weeksArr: Array<
      Array<{
        date: string;
        solved: number;
        commits: number;
        total: number;
        isFuture: boolean;
      }>
    > = [];

    const monthHeaders: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays: Array<{
        date: string;
        solved: number;
        commits: number;
        total: number;
        isFuture: boolean;
      }> = [];

      for (let d = 0; d < 7; d++) {
        const curMs = startMs + (w * 7 + d) * 86400000;
        const curDate = new Date(curMs);
        const curDateStr = curDate.toISOString().slice(0, 10);
        const act = dateActivityMap.get(curDateStr) ?? { solved: 0, commits: 0 };
        const isFuture = curDateStr > todayString;

        weekDays.push({
          date: curDateStr,
          solved: act.solved,
          commits: act.commits,
          total: act.solved + act.commits,
          isFuture,
        });

        // Check for month label change on Monday
        if (d === 0) {
          const m = curDate.getUTCMonth();
          if (m !== lastMonth) {
            monthHeaders.push({ weekIndex: w, label: monthsShort[m] });
            lastMonth = m;
          }
        }
      }
      weeksArr.push(weekDays);
    }

    return { weeks: weeksArr, monthLabels: monthHeaders, todayStr: todayString };
  }, [dateActivityMap]);

  // Compute streaks and stats (matches Codeforces/GitHub stats layout in user screenshot)
  const stats = useMemo(() => {
    const isGitHub = selectedPlatform === "github";
    const oneDayMs = 86400000;
    const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
    const oneYearAgoMs = todayMs - 365 * oneDayMs;
    const oneMonthAgoMs = todayMs - 30 * oneDayMs;

    let totalAllTime = 0;
    let totalLastYear = 0;
    let totalLastMonth = 0;

    const activeDates = new Set<string>();

    for (const [dStr, act] of dateActivityMap.entries()) {
      const count = isGitHub ? act.commits : act.solved;
      totalAllTime += count;

      const ms = new Date(dStr + "T00:00:00Z").getTime();
      if (ms >= oneYearAgoMs && ms <= todayMs) {
        totalLastYear += count;
      }
      if (ms >= oneMonthAgoMs && ms <= todayMs) {
        totalLastMonth += count;
      }

      if (count > 0) {
        activeDates.add(dStr);
      }
    }

    // Streaks calculation
    let maxStreakAllTime = 0;
    let maxStreakLastYear = 0;
    let currentRun = 0;
    let currentRunLastYear = 0;

    const sortedDates = [...activeDates].sort();
    if (sortedDates.length > 0) {
      const firstMs = new Date(sortedDates[0] + "T00:00:00Z").getTime();
      let runner = firstMs;
      while (runner <= todayMs) {
        const dStr = new Date(runner).toISOString().slice(0, 10);
        const isActive = activeDates.has(dStr);

        if (isActive) {
          currentRun++;
          if (currentRun > maxStreakAllTime) maxStreakAllTime = currentRun;
        } else {
          currentRun = 0;
        }

        if (runner >= oneYearAgoMs) {
          if (isActive) {
            currentRunLastYear++;
            if (currentRunLastYear > maxStreakLastYear) maxStreakLastYear = currentRunLastYear;
          } else {
            currentRunLastYear = 0;
          }
        }

        runner += oneDayMs;
      }
    }

    // Current streak (ending today or yesterday)
    let currentStreak = 0;
    let checkRunner = todayMs;
    const todayHasActivity = activeDates.has(new Date(checkRunner).toISOString().slice(0, 10));
    if (!todayHasActivity) {
      checkRunner -= oneDayMs;
    }
    while (activeDates.has(new Date(checkRunner).toISOString().slice(0, 10))) {
      currentStreak++;
      checkRunner -= oneDayMs;
    }

    return {
      isGitHub,
      totalAllTime,
      totalLastYear,
      totalLastMonth,
      maxStreakAllTime,
      maxStreakLastYear,
      currentStreak,
    };
  }, [dateActivityMap, selectedPlatform, todayStr]);

  // Color intensity for heatmap squares
  const getCellColor = (total: number, isFuture: boolean) => {
    if (isFuture) return "bg-transparent";
    if (total === 0) return "bg-muted/40 dark:bg-muted/20 border border-border/20";
    if (total === 1) return "bg-emerald-300 dark:bg-emerald-800/80";
    if (total <= 3) return "bg-emerald-400 dark:bg-emerald-600";
    if (total <= 6) return "bg-emerald-500 dark:bg-emerald-500";
    return "bg-emerald-600 dark:bg-emerald-400";
  };

  const unitLabel = stats.isGitHub ? "contribution" : "problem";
  const unitLabelPlural = stats.isGitHub ? "contributions" : "problems";

  return (
    <div className="space-y-6">
      {/* Platform Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {availablePlatforms.map((plat) => {
            const isSelected = selectedPlatform === plat;
            return (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatform(plat)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <PlatformIcon platform={plat} className="h-4 w-4 shrink-0" fallback={platformIcons[plat]} />
                <span>{platformLabels[plat] ?? plat}</span>
              </button>
            );
          })}
        </div>

        {/* What activity is shown dropdown selector (from screenshot) */}
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="platform-dropdown" className="text-muted-foreground hidden sm:inline">
            Platform:
          </label>
          <select
            id="platform-dropdown"
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {availablePlatforms.map((p) => (
              <option key={p} value={p}>
                {platformLabels[p] ?? p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* If Beecrowd is selected and we have Beecrowd public details, render the full Beecrowd View matching screenshots */}
      {selectedPlatform === "beecrowd" && beecrowdDetails ? (
        <BeecrowdProfileView profile={beecrowdDetails} activity={activity} profileId={profileId} />
      ) : selectedPlatform === "codeforces" && codeforcesDetails ? (
        <CodeforcesProfileView profile={codeforcesDetails} profileId={profileId} />
      ) : selectedPlatform === "vjudge" && vjudgeDetails ? (
        <VJudgeProfileView profile={vjudgeDetails} profileId={profileId} />
      ) : selectedPlatform === "github" && githubDetails ? (
        <GitHubProfileView profile={githubDetails} profileId={profileId} />
      ) : selectedPlatform === "codechef" && codechefDetails ? (
        <CodeChefProfileView profile={codechefDetails} profileId={profileId} />
      ) : (
        <>
          {/* Active Platform Header & Link Banner (if specific platform selected) */}
          {activeAccount && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <PlatformIcon platform={activeAccount.platform} className="h-7 w-7 shrink-0" fallback={<span className="text-2xl">{platformIcons[activeAccount.platform]}</span>} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">
                      {platformLabels[activeAccount.platform]}
                    </span>
                    {platformUrls[activeAccount.platform] ? (
                      <a
                        href={platformUrls[activeAccount.platform](activeAccount.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline inline-flex items-center gap-0.5"
                        title={`Open ${platformLabels[activeAccount.platform]} profile`}
                      >
                        <span>@{activeAccount.handle}</span>
                        <span className="text-[10px] opacity-70">↗</span>
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        @{activeAccount.handle}
                      </span>
                    )}
                    {activeAccount.verified ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last synchronized: {formatDateTime(activeAccount.last_synced_at)}
                  </p>
                </div>
              </div>

              {platformUrls[activeAccount.platform] && (
                <a
                  href={platformUrls[activeAccount.platform](activeAccount.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <span>Visit {platformLabels[activeAccount.platform]} Profile</span>
                  <span>↗</span>
                </a>
              )}
            </div>
          )}

          {/* Activity Heatmap & Stats Card (Designed to match the user's uploaded Codeforces screenshot) */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-semibold text-base">
                  {platformLabels[selectedPlatform]} Activity Heatmap
                </h2>
                <p className="text-xs text-muted-foreground">
                  Daily practice activity over the past 52 weeks
                </p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {todayStr}
              </span>
            </div>

            {/* Heatmap Grid */}
            <div className="relative overflow-x-auto pb-2">
              <div className="min-w-[760px]">
                {/* Month labels */}
                <div className="flex text-[11px] text-muted-foreground mb-1 pl-8">
                  {weeks.map((_, wIdx) => {
                    const header = monthLabels.find((m) => m.weekIndex === wIdx);
                    return (
                      <div key={wIdx} className="w-3 text-left">
                        {header ? header.label : ""}
                      </div>
                    );
                  })}
                </div>

                {/* Days row + grid */}
                <div className="flex">
                  {/* Day labels (Mon, Wed, Fri like in screenshot) */}
                  <div className="flex flex-col justify-between text-[10px] text-muted-foreground pr-2 w-8 py-0.5">
                    <span>Mon</span>
                    <span className="text-transparent select-none">Tue</span>
                    <span>Wed</span>
                    <span className="text-transparent select-none">Thu</span>
                    <span>Fri</span>
                    <span className="text-transparent select-none">Sat</span>
                    <span className="text-transparent select-none">Sun</span>
                  </div>

                  {/* 52 Columns of Weeks */}
                  <div className="flex gap-[3px]">
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[3px]">
                        {week.map((day) => (
                          <div
                            key={day.date}
                            className={`h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 hover:z-10 cursor-pointer ${getCellColor(
                              day.total,
                              day.isFuture
                            )}`}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredCell({
                                date: day.date,
                                solved: day.solved,
                                commits: day.commits,
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

                {/* Heatmap Legend */}
                <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                  <span>Less</span>
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-muted/40 border border-border/30" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-300 dark:bg-emerald-800" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-400 dark:bg-emerald-600" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500 dark:bg-emerald-500" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-600 dark:bg-emerald-400" />
                  <span>More</span>
                </div>
              </div>
            </div>

            {/* 6 Core Statistics (Matches the exact layout of the user's screenshot) */}
            <div className="grid grid-cols-1 gap-6 border-t border-border pt-6 sm:grid-cols-3">
              {/* Top Row: Total Solved */}
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.totalAllTime}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.totalAllTime === 1 ? unitLabel : unitLabelPlural}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">solved for all time</p>
              </div>

              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.totalLastYear}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.totalLastYear === 1 ? unitLabel : unitLabelPlural}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">solved for the last year</p>
              </div>

              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.totalLastMonth}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.totalLastMonth === 1 ? unitLabel : unitLabelPlural}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">solved for the last month</p>
              </div>

              {/* Bottom Row: Streaks */}
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.maxStreakAllTime}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.maxStreakAllTime === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">in a row max.</p>
              </div>

              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.maxStreakLastYear}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.maxStreakLastYear === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">in a row for the last year</p>
              </div>

              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {stats.currentStreak}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {stats.currentStreak === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">current active streak</p>
              </div>
            </div>
          </section>

          {/* Contest Participation for the Selected Platform */}
          {(selectedPlatform === "all" ||
            selectedPlatform === "codeforces" ||
            selectedPlatform === "hackerrank") && (
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="border-b border-border pb-3">
                <h2 className="font-semibold text-base">
                  {selectedPlatform === "all"
                    ? "Contest Participation"
                    : `${platformLabels[selectedPlatform]} Contests`}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official rated contests recorded for this member
                </p>
              </div>

              {filteredContests.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 font-medium">Contest</th>
                        <th className="pb-2 font-medium">Platform</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium text-right">Rank</th>
                        <th className="pb-2 font-medium text-right">Rating Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredContests.map((c, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="py-2.5 font-medium">{c.contest_name}</td>
                          <td className="py-2.5 capitalize text-muted-foreground">
                            {c.platform}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {formatDate(c.contest_date)}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {c.rank != null ? `#${c.rank}` : "—"}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold">
                            {c.rating_change != null ? (
                              <span
                                className={
                                  c.rating_change >= 0 ? "text-green-600" : "text-destructive"
                                }
                              >
                                {c.rating_change >= 0 ? `+${c.rating_change}` : c.rating_change}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No rated contest participations recorded for {platformLabels[selectedPlatform]}.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md transition-all -translate-x-1/2 -translate-y-full mb-1"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 6}px`,
          }}
        >
          <p className="font-semibold">{hoveredCell.date}</p>
          <p className="text-muted-foreground text-[11px]">
            {stats.isGitHub
              ? `${hoveredCell.commits} contribution${hoveredCell.commits === 1 ? "" : "s"}`
              : `${hoveredCell.solved} problem${hoveredCell.solved === 1 ? "" : "s"} solved`}
          </p>
        </div>
      )}
    </div>
  );
}

