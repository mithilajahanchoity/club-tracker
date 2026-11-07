"use client";

import { useState, useMemo } from "react";
import { PlatformIcon } from "./platform-icon";
import type { LeetCodePublicProfile, LeetCodeContestPoint } from "@/lib/leetcode";
import { ContestParticipationTable, type ContestItem } from "./contest-participation-table";

interface LeetCodeProfileViewProps {
  profile: LeetCodePublicProfile;
  profileId?: string;
  contests?: ContestItem[];
}

const monthsShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function LeetCodeProfileView({ profile, contests: propContests }: LeetCodeProfileViewProps) {
  const [selectedYear, setSelectedYear] = useState<string>("rolling");
  const [hoveredPoint, setHoveredPoint] = useState<LeetCodeContestPoint | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Available years from activity map and contest history
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add(String(currentYear));
    years.add(String(currentYear - 1));
    for (const dStr of Object.keys(profile.activityMap)) {
      years.add(dStr.slice(0, 4));
    }
    for (const c of profile.contestHistory) {
      if (c.dateIso) years.add(c.dateIso.slice(0, 4));
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [profile.activityMap, profile.contestHistory]);

  // Build the 52-Week Heatmap Grid
  const { weeks, monthHeaders } = useMemo(() => {
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 3600000);
    const todayString = bdNow.toISOString().slice(0, 10);

    let startDate: Date;
    let endDate: Date;

    if (selectedYear === "rolling") {
      endDate = new Date(Date.UTC(bdNow.getUTCFullYear(), bdNow.getUTCMonth(), bdNow.getUTCDate()));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - 364);
    } else {
      const yr = parseInt(selectedYear, 10);
      startDate = new Date(Date.UTC(yr, 0, 1));
      endDate = new Date(Date.UTC(yr, 11, 31));
    }

    const startDayOfWeek = (startDate.getUTCDay() + 6) % 7; // Monday = 0
    const alignedStart = new Date(startDate);
    alignedStart.setUTCDate(alignedStart.getUTCDate() - startDayOfWeek);

    const weeksArr: Array<
      Array<{
        date: string;
        count: number;
        isFuture: boolean;
        inSelectedYear: boolean;
      }>
    > = [];

    const headers: Array<{ weekIndex: number; label: string }> = [];
    let currentMonth = -1;

    for (let w = 0; w < 53; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(alignedStart);
        dayDate.setUTCDate(alignedStart.getUTCDate() + (w * 7 + d));
        const dateIso = dayDate.toISOString().slice(0, 10);
        const count = profile.activityMap[dateIso] || 0;
        const isFuture = dateIso > todayString;
        const inSelectedYear =
          selectedYear === "rolling" || dateIso.startsWith(selectedYear);

        weekDays.push({
          date: dateIso,
          count,
          isFuture,
          inSelectedYear,
        });

        if (d === 0) {
          const month = dayDate.getUTCMonth();
          if (month !== currentMonth) {
            headers.push({ weekIndex: w, label: monthsShort[month] });
            currentMonth = month;
          }
        }
      }
      weeksArr.push(weekDays);
    }

    return { weeks: weeksArr, monthHeaders: headers };
  }, [profile.activityMap, selectedYear]);

  // LeetCode emerald/yellow-green heatmap cell color
  const getCellColor = (count: number, isFuture: boolean) => {
    if (isFuture) return "bg-transparent opacity-0 pointer-events-none";
    if (count === 0) return "bg-muted/40 border border-border/40 dark:bg-[#252c37] dark:border-[#2f3946]";
    if (count <= 2) return "bg-emerald-300 dark:bg-[#18632e] border border-emerald-400/30";
    if (count <= 5) return "bg-emerald-500 dark:bg-[#218838] border border-emerald-600/40";
    if (count <= 10) return "bg-emerald-600 dark:bg-[#2ecc71] border border-emerald-500/50";
    return "bg-emerald-400 dark:bg-[#38d39f] border border-emerald-300";
  };

  // Rating graph SVG dimensions & coordinates
  const graphData = useMemo(() => {
    if (profile.contestHistory.length === 0) return null;

    const displayed = profile.contestHistory;
    const ratings = displayed.map((c) => c.rating);
    const minRating = Math.max(1000, Math.min(...ratings) - 100);
    const maxRating = Math.max(...ratings) + 100;
    const ratingRange = Math.max(1, maxRating - minRating);

    const width = 800;
    const height = 240;
    const paddingX = 40;
    const paddingY = 30;

    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    const points = displayed.map((c, i) => {
      const x =
        displayed.length === 1
          ? width / 2
          : paddingX + (i / (displayed.length - 1)) * plotW;
      const y = height - paddingY - ((c.rating - minRating) / ratingRange) * plotH;
      return { ...c, x, y };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, "");

    return { width, height, paddingX, paddingY, minRating, maxRating, points, pathD };
  }, [profile.contestHistory]);

  const lcContestItems: ContestItem[] = useMemo(() => {
    if (propContests && propContests.length > 0) return propContests;
    return profile.contestHistory.map((c) => ({
      contest_name: c.title,
      platform: "leetcode",
      contest_date: c.dateIso,
      rank: c.ranking,
      rating_change: c.ratingChange,
      url: c.url,
    }));
  }, [profile.contestHistory, propContests]);

  const profileUrl = `https://leetcode.com/u/${encodeURIComponent(profile.handle)}`;

  // Solved percentages for progress bar
  const total = profile.totalSolved || 1;
  const easyPct = Math.round((profile.easySolved / total) * 100);
  const medPct = Math.round((profile.mediumSolved / total) * 100);
  const hardPct = Math.max(0, 100 - easyPct - medPct);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BANNER: LeetCode Profile Header Card
         ========================================================================= */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          {/* Left: Avatar + Handle + Details */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-muted/40 shadow-sm">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatarUrl}
                  alt={profile.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-yellow-600/30 text-3xl font-bold text-amber-500">
                  🔶
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {profile.realName || profile.handle}
                </h2>
                {profile.contestBadge && (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    {profile.contestBadge}
                  </span>
                )}
                {profile.ranking && (
                  <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Rank #{profile.ranking.toLocaleString()}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <PlatformIcon platform="leetcode" className="h-3.5 w-3.5 inline" />
                  @{profile.handle}
                  <span className="text-[10px] opacity-70">↗</span>
                </a>
                {profile.country && (
                  <>
                    <span>&bull;</span>
                    <span>📍 {profile.country}</span>
                  </>
                )}
                {profile.school && (
                  <>
                    <span>&bull;</span>
                    <span className="max-w-[200px] truncate" title={profile.school}>
                      🏛 {profile.school}
                    </span>
                  </>
                )}
                {profile.company && (
                  <>
                    <span>&bull;</span>
                    <span className="max-w-[200px] truncate" title={profile.company}>
                      💼 {profile.company}
                    </span>
                  </>
                )}
              </div>

              {/* Skill Tags */}
              {profile.skillTags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {profile.skillTags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Visit Button */}
          <div className="flex items-center gap-2">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted shadow-xs"
            >
              <span>Visit LeetCode Profile</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KEY STATS CARDS: Rating, Ranks, Solved, Streak
         ========================================================================= */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Contest Rating Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Contest Rating</span>
            {profile.contestBadge && (
              <span className="rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-1 text-[11px]">
                {profile.contestBadge}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-amber-500">
              {profile.contestRating ?? "Unrated"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {profile.topPercentage != null ? (
              <>Top <b className="text-foreground">{profile.topPercentage}%</b> worldwide</>
            ) : (
              "Participate in weekly contests"
            )}
          </p>
        </div>

        {/* Global Contest Rank */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Global Contest Rank</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {profile.contestGlobalRanking
              ? `#${profile.contestGlobalRanking.toLocaleString()}`
              : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Total participants:{" "}
            <b className="text-foreground">
              {profile.totalParticipants
                ? profile.totalParticipants.toLocaleString()
                : "—"}
            </b>
          </p>
        </div>

        {/* Total Problems Solved */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Problems Solved</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-emerald-500">
            {profile.totalSolved}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Acceptance Rate: <b className="text-foreground">{profile.acceptanceRate}%</b>
          </p>
        </div>

        {/* Active Streak & Activity */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Activity Streak</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {profile.streak} <span className="text-sm font-semibold text-muted-foreground">days</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Active Days: <b className="text-foreground">{profile.totalActiveDays} days</b>
          </p>
        </div>
      </section>

      {/* =========================================================================
          PROBLEMS SOLVED BY DIFFICULTY BREAKDOWN
         ========================================================================= */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Solved Problems by Difficulty</h3>
            <p className="text-xs text-muted-foreground">
              Breakdown across Easy, Medium, and Hard LeetCode challenges
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {profile.totalSolved} Solved / {profile.totalSubmissions} Submissions
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60 flex">
          <div
            style={{ width: `${easyPct}%` }}
            className="bg-emerald-500 h-full transition-all"
            title={`Easy: ${profile.easySolved} (${easyPct}%)`}
          />
          <div
            style={{ width: `${medPct}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Medium: ${profile.mediumSolved} (${medPct}%)`}
          />
          <div
            style={{ width: `${hardPct}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`Hard: ${profile.hardSolved} (${hardPct}%)`}
          />
        </div>

        {/* 3 Difficulty Metric Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
          {/* Easy */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Easy</span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {profile.totalSolved > 0 ? `${easyPct}%` : "—"}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {profile.easySolved}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Elementary & Fundamentals</p>
          </div>

          {/* Medium */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Medium</span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {profile.totalSolved > 0 ? `${medPct}%` : "—"}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
              {profile.mediumSolved}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Core Algorithms & Data Structures</p>
          </div>

          {/* Hard */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 dark:border-rose-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Hard</span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {profile.totalSolved > 0 ? `${hardPct}%` : "—"}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
              {profile.hardSolved}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Advanced Optimization & Dynamic Prog</p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CONTEST RATING PROGRESSION GRAPH
         ========================================================================= */}
      {graphData && graphData.points.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Contest Rating Progression</h3>
              <p className="text-xs text-muted-foreground">
                Official rated Weekly &amp; Biweekly contest performance on LeetCode
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {profile.contestHistory.length} Contests Attended
              </span>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              className="w-full h-auto min-w-[600px] select-none"
            >
              {/* Horizontal Reference Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = graphData.paddingY + pct * (graphData.height - graphData.paddingY * 2);
                const ratingVal = Math.round(graphData.maxRating - pct * (graphData.maxRating - graphData.minRating));
                return (
                  <g key={pct}>
                    <line
                      x1={graphData.paddingX}
                      y1={y}
                      x2={graphData.width - graphData.paddingX}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={graphData.paddingX - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px] font-mono"
                    >
                      {ratingVal}
                    </text>
                  </g>
                );
              })}

              {/* Progression Path */}
              <path
                d={graphData.pathD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Contest Data Points */}
              {graphData.points.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint?.title === p.title && hoveredPoint?.dateIso === p.dateIso ? 6 : 3.5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-all hover:scale-150"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>

            {/* Interactive Graph Tooltip */}
            {hoveredPoint && (
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-card p-3 shadow-md text-xs space-y-1">
                <div className="flex items-center justify-between gap-3 font-semibold text-foreground">
                  <span>{hoveredPoint.title}</span>
                  <span className="font-mono text-amber-500">Rating: {hoveredPoint.rating}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-muted-foreground text-[11px]">
                  <span>Date: {hoveredPoint.dateFormatted}</span>
                  <span>Rank: #{hoveredPoint.ranking.toLocaleString()}</span>
                  <span>Solved: {hoveredPoint.problemsSolved}/{hoveredPoint.totalProblems}</span>
                  {hoveredPoint.ratingChange !== 0 && (
                    <span className={hoveredPoint.ratingChange > 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                      Change: {hoveredPoint.ratingChange > 0 ? `+${hoveredPoint.ratingChange}` : hoveredPoint.ratingChange}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          52-WEEK ACTIVITY HEATMAP CALENDAR
         ========================================================================= */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4">
        {/* Header Row: Title & Year Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Submission Activity</h3>
            <p className="text-xs text-muted-foreground">
              Daily problem solving frequency across the calendar year
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Select year for LeetCode activity"
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors hover:border-ring"
            >
              <option value="rolling">Last 12 Months</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[760px] select-none">
            {/* Month Labels */}
            <div className="flex text-[11px] font-medium text-muted-foreground mb-1.5 pl-10">
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
              {/* Day Labels */}
              <div className="flex flex-col justify-between text-[10px] font-semibold text-muted-foreground pr-2 w-10 h-[98px] py-0.5">
                <span>Mon</span>
                <span className="text-transparent select-none">Tue</span>
                <span>Wed</span>
                <span className="text-transparent select-none">Thu</span>
                <span>Fri</span>
                <span className="text-transparent select-none">Sat</span>
                <span>Sun</span>
              </div>

              {/* 52 Columns of 7 Squares */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className={`h-[11px] w-[11px] rounded-[1px] transition-transform hover:scale-125 cursor-pointer ${
                          !day.inSelectedYear
                            ? "bg-muted/15 opacity-20 pointer-events-none"
                            : getCellColor(day.count, day.isFuture)
                        }`}
                        onMouseEnter={(e) => {
                          if (day.isFuture || !day.inSelectedYear) return;
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
                className="fixed z-50 rounded bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full mb-1 border border-border"
                style={{
                  left: `${hoveredCell.x + 6}px`,
                  top: `${hoveredCell.y - 4}px`,
                }}
              >
                {hoveredCell.count > 0
                  ? `${hoveredCell.count} ${hoveredCell.count === 1 ? "problem" : "problems"} solved on ${hoveredCell.date}`
                  : `No problems solved on ${hoveredCell.date}`}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground pt-2 border-t border-border/50">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-xs bg-muted/40 border border-border/40" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-300 dark:bg-[#18632e]" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 dark:bg-[#218838]" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600 dark:bg-[#2ecc71]" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400 dark:bg-[#38d39f]" />
          <span>More</span>
        </div>
      </section>

      {/* =========================================================================
          BADGES GALLERY (If member has LeetCode badges)
         ========================================================================= */}
      {profile.badges.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">LeetCode Badges</h3>
              <p className="text-xs text-muted-foreground">
                Earned study plan badges, streak milestones, and contest awards
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {profile.badges.length} Badges
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {profile.badges.map((b, idx) => (
              <div
                key={b.id || idx}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/20 p-3 text-center transition-transform hover:scale-105"
              >
                <div className="flex h-12 w-12 items-center justify-center mb-2">
                  {b.icon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.icon} alt={b.displayName} className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="text-2xl">🎖</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground line-clamp-2">{b.displayName}</p>
                {b.creationDate && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{b.creationDate}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          RECENT SUBMISSIONS LIST
         ========================================================================= */}
      {profile.recentSubmissions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-base font-semibold text-foreground">Recent Submissions</h3>
            <p className="text-xs text-muted-foreground">
              Recently solved LeetCode challenges
            </p>
          </div>

          <div className="divide-y divide-border/60">
            {profile.recentSubmissions.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5 text-xs first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 text-[10px]">
                    {s.statusDisplay || "Accepted"}
                  </span>
                  <a
                    href={`https://leetcode.com/problems/${s.titleSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:underline transition-colors"
                  >
                    {s.title}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {s.lang && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-mono">
                      {s.lang}
                    </span>
                  )}
                  {s.timestamp && <span>{s.timestamp}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          LEETCODE CONTEST PARTICIPATION TABLE
         ========================================================================= */}
      <ContestParticipationTable
        contests={lcContestItems}
        title="LeetCode Contest Participation"
        subtitle="Official rated contests recorded on LeetCode for this member"
        emptyMessage="No rated contest participations recorded for LeetCode."
        showPlatform={true}
      />
    </div>
  );
}
