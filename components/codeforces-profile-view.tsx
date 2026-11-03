"use client";

import { useState, useMemo } from "react";
import type { CodeforcesPublicProfile, CodeforcesContestPoint } from "@/lib/codeforces";
import { ContestParticipationTable, type ContestItem } from "./contest-participation-table";

interface CodeforcesProfileViewProps {
  profile: CodeforcesPublicProfile;
  profileId?: string;
  contests?: ContestItem[];
}

const monthsShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function CodeforcesProfileView({ profile, contests: propContests }: CodeforcesProfileViewProps) {
  const [filterType, setFilterType] = useState<"rated" | "all">("rated");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("rolling");
  const [hoveredPoint, setHoveredPoint] = useState<CodeforcesContestPoint | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Available years from activity map
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add(String(currentYear));
    years.add(String(currentYear - 1));
    for (const dStr of Object.keys(profile.activityMap)) {
      years.add(dStr.slice(0, 4));
    }
    for (const c of profile.contestHistory) {
      years.add(c.dateIso.slice(0, 4));
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [profile.activityMap, profile.contestHistory]);

  // 1. Build the 52-Week Heatmap Grid
  const { weeks, monthHeaders } = useMemo(() => {
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 3600000);
    const todayString = bdNow.toISOString().slice(0, 10);

    let startMs: number;
    let endMs: number;
    const totalWeeks = 53;

    if (selectedYear !== "rolling") {
      const yr = parseInt(selectedYear, 10);
      const startOfYear = new Date(Date.UTC(yr, 0, 1));
      const dayOfWeek = (startOfYear.getUTCDay() + 6) % 7;
      startMs = startOfYear.getTime() - dayOfWeek * 86400000;
      endMs = startMs + (totalWeeks * 7 - 1) * 86400000;
    } else {
      const dayOfWeek = (bdNow.getUTCDay() + 6) % 7;
      const daysUntilSunday = 6 - dayOfWeek;
      endMs = bdNow.getTime() + daysUntilSunday * 86400000;
      startMs = endMs - (totalWeeks * 7 - 1) * 86400000;
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

  // Contests to plot
  const contests = useMemo(() => {
    return profile.contestHistory;
  }, [profile.contestHistory]);

  const cfContestItems: ContestItem[] = useMemo(() => {
    if (propContests && propContests.length > 0) return propContests;
    return profile.contestHistory.map((c) => ({
      contest_name: c.contestName,
      platform: "codeforces",
      contest_date: c.dateIso,
      rank: c.rank,
      rating_change: c.ratingChange,
      url: `https://codeforces.com/contest/${c.contestId}`,
    }));
  }, [profile.contestHistory, propContests]);

  // SVG Chart Dimensions & Scale
  const chartHeight = 240;
  const chartWidth = 720;
  const maxScaleRating = 2100; // Codeforces standard view tops out above 1900 into Candidate Master
  const minScaleRating = 0;

  // Convert rating to Y position (0 at top, chartHeight at bottom)
  const getY = (r: number) => {
    const clamped = Math.max(minScaleRating, Math.min(maxScaleRating, r));
    return chartHeight - (clamped / maxScaleRating) * chartHeight;
  };

  // Convert contest index or date to X position
  const getX = (idx: number, total: number) => {
    if (total <= 1) return chartWidth * 0.52; // Centered near middle-right like in screenshot
    return 40 + (idx / (total - 1)) * (chartWidth - 80);
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BOX: Codeforces Rating History Graph (Matches Screenshot Top Panel)
         ========================================================================= */}
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-5">
        {/* Header Controls */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground select-none">
            Click on the graph to enable the zoom feature.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "rated" | "all")}
              aria-label="Filter contests"
              className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-foreground shadow-xs outline-none transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="rated">Only rated</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Rating Chart with Division Colored Stripes */}
        <div className="relative overflow-x-auto">
          <div className="relative mx-auto min-w-[700px] max-w-[850px] select-none">
            {/* Y-Axis Division Labels on Left */}
            <div
              className="absolute left-0 top-0 flex flex-col justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
              style={{ height: `${chartHeight}px`, width: "36px" }}
            >
              <span style={{ transform: "translateY(-4px)" }}>1900</span>
              <span style={{ transform: "translateY(18px)" }}>1600</span>
              <span style={{ transform: "translateY(36px)" }}>1400</span>
              <span style={{ transform: "translateY(54px)" }}>1200</span>
              <span className="opacity-0 select-none">0</span>
            </div>

            {/* Main Graph Box with Division Stripes */}
            <div
              className="relative ml-10 border border-zinc-600/90 dark:border-zinc-500 overflow-hidden"
              style={{ height: `${chartHeight}px` }}
            >
              {/* Division Colored Stripes (Background Bands) */}
              {/* 1. Candidate Master + (1900+) Pink / Magenta */}
              <div
                className="absolute inset-x-0 top-0"
                style={{
                  height: `${getY(1900)}px`,
                  backgroundColor: "rgba(255, 136, 255, 0.45)",
                }}
              />
              {/* 2. Expert (1600 - 1900) Lavender / Soft Blue */}
              <div
                className="absolute inset-x-0"
                style={{
                  top: `${getY(1900)}px`,
                  height: `${getY(1600) - getY(1900)}px`,
                  backgroundColor: "rgba(170, 170, 255, 0.5)",
                }}
              />
              {/* 3. Specialist (1400 - 1600) Mint-Aqua / Cyan */}
              <div
                className="absolute inset-x-0"
                style={{
                  top: `${getY(1600)}px`,
                  height: `${getY(1400) - getY(1600)}px`,
                  backgroundColor: "rgba(119, 221, 187, 0.55)",
                }}
              />
              {/* 4. Pupil (1200 - 1400) Light Green */}
              <div
                className="absolute inset-x-0"
                style={{
                  top: `${getY(1400)}px`,
                  height: `${getY(1200) - getY(1400)}px`,
                  backgroundColor: "rgba(119, 255, 119, 0.55)",
                }}
              />
              {/* 5. Newbie (0 - 1200) Light Gray */}
              <div
                className="absolute inset-x-0"
                style={{
                  top: `${getY(1200)}px`,
                  bottom: 0,
                  backgroundColor: "rgba(204, 204, 204, 0.45)",
                }}
              />

              {/* In-Graph Legend (Top Right: Yellow box + Handle) */}
              <a
                href={`https://codeforces.com/profile/${encodeURIComponent(profile.handle)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${profile.handle} on Codeforces`}
                className="absolute right-3 top-2.5 z-10 flex items-center gap-1.5 rounded bg-white/95 px-2 py-0.5 text-xs font-semibold text-zinc-800 shadow-xs backdrop-blur-xs transition-colors hover:text-blue-600 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:text-blue-400"
              >
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-400 border border-amber-500" />
                <span>{profile.handle}</span>
                <span className="text-[10px] opacity-70">↗</span>
              </a>

              {/* SVG Overlay for Connecting Lines and Plotted Points */}
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
              >
                {/* Connecting Polyline if more than 1 contest */}
                {contests.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    points={contests
                      .map((c, i) => `${getX(i, contests.length)},${getY(c.newRating)}`)
                      .join(" ")}
                  />
                )}

                {/* Vertical guide lines from points to bottom */}
                {contests.map((_, i) => {
                  const x = getX(i, contests.length);
                  return (
                    <line
                      key={`guide-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={chartHeight}
                      stroke="rgba(0, 0, 0, 0.15)"
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>

              {/* Interactive Plotted Points */}
              {contests.map((c, i) => {
                const x = getX(i, contests.length);
                const y = getY(c.newRating);
                return (
                  <div
                    key={`point-${i}`}
                    className="absolute z-20 cursor-pointer -translate-x-1/2 -translate-y-1/2 group"
                    style={{
                      left: `${(x / chartWidth) * 100}%`,
                      top: `${y}px`,
                    }}
                    onMouseEnter={() => setHoveredPoint(c)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Outer Circle with Red Ring & White Fill (matches screenshot point) */}
                    <div className="h-3 w-3 rounded-full border-2 border-red-600 bg-white transition-transform group-hover:scale-150 shadow-xs" />
                  </div>
                );
              })}

              {/* Tooltip on Hover */}
              {hoveredPoint && (
                <div
                  className="absolute z-30 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md pointer-events-none"
                  style={{
                    left: `${(getX(contests.findIndex(c => c.contestId === hoveredPoint.contestId), contests.length) / chartWidth) * 100}%`,
                    top: `${Math.max(10, getY(hoveredPoint.newRating) - 75)}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <p className="font-semibold text-foreground">{hoveredPoint.contestName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {hoveredPoint.contestDate} &middot; Rank: #{hoveredPoint.rank}
                  </p>
                  <p className="font-mono text-xs font-bold text-foreground mt-1">
                    Rating: {hoveredPoint.newRating}{" "}
                    <span className={hoveredPoint.ratingChange >= 0 ? "text-green-600" : "text-red-500"}>
                      ({hoveredPoint.ratingChange >= 0 ? `+${hoveredPoint.ratingChange}` : hoveredPoint.ratingChange})
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* X-Axis Dates below the chart */}
            <div className="relative ml-10 mt-2 text-center text-xs text-zinc-700 dark:text-zinc-300">
              {contests.length > 0 ? (
                contests.map((c, i) => (
                  <span
                    key={`axis-${i}`}
                    className="inline-block"
                    style={{
                      position: contests.length === 1 ? "static" : "absolute",
                      left: contests.length === 1 ? undefined : `${(getX(i, contests.length) / chartWidth) * 100}%`,
                      transform: contests.length === 1 ? undefined : "translateX(-50%)",
                    }}
                  >
                    {c.contestDate}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">No rated contests recorded</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BOTTOM BOX: Codeforces Activity Heatmap & 6 Stats (Matches Screenshot)
         ========================================================================= */}
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-5 space-y-6">
        {/* Header Controls (Right-aligned, matching screenshot) */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 text-xs">
          <label htmlFor="cf-activity-filter" className="text-zinc-600 dark:text-zinc-400">
            What activity will be shown to other users:
          </label>
          <select
            id="cf-activity-filter"
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-foreground outline-none transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="all">All</option>
            <option value="solved">Only solved problems</option>
            <option value="contests">Only contests</option>
          </select>

          <select
            id="cf-year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-foreground outline-none transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="rolling">Choose year</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* 52-Week Heatmap Calendar Grid */}
        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[760px] select-none">
            {/* Month Header Labels */}
            <div className="flex text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 pl-9">
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
              <div className="flex flex-col justify-between text-[11px] text-zinc-600 dark:text-zinc-400 pr-2 w-9 h-[95px] py-0.5">
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
                    {week.map((day) => {
                      const isActive = day.count > 0 && !day.isFuture;
                      return (
                        <div
                          key={day.date}
                          className={`h-[11px] w-[11px] rounded-[1px] transition-transform hover:scale-125 cursor-pointer ${
                            day.isFuture
                              ? "bg-transparent opacity-0"
                              : isActive
                              ? "bg-[#2ecc71] dark:bg-[#27ae60]" // Vibrant Codeforces Green
                              : "bg-[#ebedf0] dark:bg-zinc-800/80 border border-zinc-200/40 dark:border-zinc-700/30"
                          }`}
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
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Cell Tooltip */}
            {hoveredCell && (
              <div
                className="fixed z-50 rounded bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-full mb-1"
                style={{
                  left: `${hoveredCell.x + 6}px`,
                  top: `${hoveredCell.y - 4}px`,
                }}
              >
                {hoveredCell.count > 0
                  ? `${hoveredCell.count} ${hoveredCell.count === 1 ? "problem" : "problems"} solved on ${hoveredCell.date}`
                  : `No activity on ${hoveredCell.date}`}
              </div>
            )}
          </div>
        </div>

        {/* 6 Core Statistics (Exact 2 rows x 3 columns matching screenshot) */}
        <div className="grid grid-cols-1 gap-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 sm:grid-cols-3">
          {/* Row 1, Col 1: Problems solved for all time */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.totalAllTime}</span>{" "}
              <span>{profile.stats.totalAllTime === 1 ? "problem" : "problems"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">solved for all time</p>
          </div>

          {/* Row 1, Col 2: Problems solved for the last year */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.totalLastYear}</span>{" "}
              <span>{profile.stats.totalLastYear === 1 ? "problem" : "problems"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">solved for the last year</p>
          </div>

          {/* Row 1, Col 3: Problems solved for the last month */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.totalLastMonth}</span>{" "}
              <span>{profile.stats.totalLastMonth === 1 ? "problem" : "problems"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">solved for the last month</p>
          </div>

          {/* Row 2, Col 1: Days in a row max. */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.maxStreakAllTime}</span>{" "}
              <span>{profile.stats.maxStreakAllTime === 1 ? "day" : "days"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">in a row max.</p>
          </div>

          {/* Row 2, Col 2: Days in a row for the last year */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.maxStreakLastYear}</span>{" "}
              <span>{profile.stats.maxStreakLastYear === 1 ? "day" : "days"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">in a row for the last year</p>
          </div>

          {/* Row 2, Col 3: Days in a row for the last month */}
          <div>
            <p className="text-3xl font-normal tracking-tight text-foreground font-sans">
              <span className="font-semibold">{profile.stats.maxStreakLastMonth}</span>{" "}
              <span>{profile.stats.maxStreakLastMonth === 1 ? "day" : "days"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">in a row for the last month</p>
          </div>
        </div>
      </section>
      {/* Codeforces Contest Participation Table */}
      <ContestParticipationTable
        contests={cfContestItems}
        title="Codeforces Contest Participation"
        subtitle="Official rated contests recorded on Codeforces for this member"
        emptyMessage="No rated contest participations recorded for Codeforces."
        showPlatform={true}
      />
    </div>
  );
}
