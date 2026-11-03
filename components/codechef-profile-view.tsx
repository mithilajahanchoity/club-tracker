"use client";

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/format";
import { PlatformIcon } from "./platform-icon";
import type { CodeChefPublicProfile, CodeChefContestPoint } from "@/lib/codechef";
import { ContestParticipationTable, type ContestItem } from "./contest-participation-table";

interface CodeChefProfileViewProps {
  profile: CodeChefPublicProfile;
  profileId?: string;
  contests?: ContestItem[];
}

const monthsShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function CodeChefProfileView({ profile, contests: propContests }: CodeChefProfileViewProps) {
  const [contestFilter, setContestFilter] = useState<"all" | "recent">("recent");
  const [selectedYear, setSelectedYear] = useState<string>("rolling");
  const [hoveredPoint, setHoveredPoint] = useState<CodeChefContestPoint | null>(null);
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

  // CodeChef warm color scale for heatmap
  const getCellColor = (count: number, isFuture: boolean) => {
    if (isFuture) return "bg-muted/10 opacity-30 border-dashed border-border/20";
    if (count === 0) return "bg-muted/30 border border-border/30";
    if (count <= 2) return "bg-amber-800/60 border border-amber-700/50";
    if (count <= 5) return "bg-amber-600 border border-amber-500/70";
    if (count <= 9) return "bg-amber-500 border border-amber-400";
    return "bg-yellow-400 border border-yellow-300";
  };

  // Filtered contests for rating graph & table
  const displayedContests = useMemo(() => {
    if (contestFilter === "recent") {
      return profile.contestHistory.slice(-25);
    }
    return profile.contestHistory;
  }, [profile.contestHistory, contestFilter]);

  // Rating graph SVG dimensions & coordinates
  const graphData = useMemo(() => {
    if (displayedContests.length === 0) return null;

    const ratings = displayedContests.map((c) => c.rating);
    const minRating = Math.max(0, Math.min(...ratings) - 100);
    const maxRating = Math.max(...ratings) + 100;
    const ratingRange = Math.max(1, maxRating - minRating);

    const width = 800;
    const height = 240;
    const paddingX = 40;
    const paddingY = 30;

    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    const points = displayedContests.map((c, i) => {
      const x =
        displayedContests.length === 1
          ? width / 2
          : paddingX + (i / (displayedContests.length - 1)) * plotW;
      const y = height - paddingY - ((c.rating - minRating) / ratingRange) * plotH;
      return { ...c, x, y };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, "");

    return { width, height, paddingX, paddingY, minRating, maxRating, points, pathD };
  }, [displayedContests]);

  const ccContestItems: ContestItem[] = useMemo(() => {
    if (propContests && propContests.length > 0) return propContests;
    return profile.contestHistory.map((c) => ({
      contest_name: c.name,
      platform: "codechef",
      contest_date: c.dateIso,
      rank: c.rank,
      rating_change: c.ratingChange,
      url: c.code ? `https://www.codechef.com/${c.code}` : undefined,
    }));
  }, [profile.contestHistory, propContests]);

  const profileUrl = `https://www.codechef.com/users/${encodeURIComponent(profile.handle)}`;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BANNER: CodeChef Profile Header Card
         ========================================================================= */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          {/* Left: Avatar + Handle + Details */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-sm">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatarUrl}
                  alt={profile.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-600/20 to-orange-600/30 text-3xl font-bold text-amber-600">
                  👨‍🍳
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {profile.name || profile.handle}
                </h2>
                {profile.stars && (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold text-white shadow-xs"
                    style={{ backgroundColor: profile.starColor }}
                  >
                    {profile.stars}
                  </span>
                )}
                {profile.division && (
                  <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {profile.division}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <PlatformIcon platform="codechef" className="h-3.5 w-3.5 inline" />
                  @{profile.handle}
                  <span className="text-[10px] opacity-70">↗</span>
                </a>
                {profile.country && (
                  <>
                    <span>•</span>
                    <span>📍 {profile.country}</span>
                  </>
                )}
                {profile.institution && (
                  <>
                    <span>•</span>
                    <span className="max-w-[240px] truncate" title={profile.institution}>
                      🏛 {profile.institution}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Button */}
          <div className="flex items-center gap-2">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted shadow-xs"
            >
              <span>Visit CodeChef Profile</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KEY STATS CARDS: Rating, Ranks, Solved, Streak
         ========================================================================= */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Rating Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>CodeChef Rating</span>
            {profile.stars && (
              <span
                className="rounded px-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: profile.starColor }}
              >
                {profile.stars}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-2xl font-black tracking-tight"
              style={{ color: profile.rating ? profile.starColor : undefined }}
            >
              {profile.rating ?? "Unrated"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Highest Rating: <b className="text-foreground">{profile.highestRating ?? "—"}</b>
          </p>
        </div>

        {/* Global & Country Rank Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Global Rank</p>
          <p className="mt-2 text-2xl font-black tracking-tight">
            {profile.globalRankText ?? (profile.globalRank ? `#${profile.globalRank.toLocaleString()}` : "—")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Country Rank:{" "}
            <b className="text-foreground">
              {profile.countryRankText ?? (profile.countryRank ? `#${profile.countryRank.toLocaleString()}` : "—")}
            </b>
          </p>
        </div>

        {/* Problems Solved Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Problems Solved</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-amber-500">
            {profile.totalSolved}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            All-Time Practice & Contests
          </p>
        </div>

        {/* Contests Count Card */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Contests Rated</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {profile.contestHistory.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Max Streak: <b className="text-foreground">{profile.stats.maxStreakAllTime} days</b>
          </p>
        </div>
      </section>

      {/* =========================================================================
          BADGES SECTION (Authentic CodeChef Badges)
         ========================================================================= */}
      {profile.badges.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CodeChef Badges
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {profile.badges.map((b, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium shadow-2xs transition-colors hover:bg-muted"
                title={b.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.icon} alt={b.name} className="h-6 w-6 shrink-0 object-contain" />
                <span className="text-foreground">{b.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          RATING GRAPH SECTION (CodeChef Official Rating Progression)
         ========================================================================= */}
      {profile.contestHistory.length > 0 && graphData && (
        <section className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">CodeChef Rating Progression</h3>
              <p className="text-xs text-muted-foreground">
                Showing {displayedContests.length} rated contests
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setContestFilter("recent")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  contestFilter === "recent"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Recent (25)
              </button>
              <button
                type="button"
                onClick={() => setContestFilter("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  contestFilter === "all"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({profile.contestHistory.length})
              </button>
            </div>
          </div>

          {/* SVG Rating Graph */}
          <div className="relative mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              className="w-full h-auto min-w-[550px] overflow-visible"
            >
              {/* Horizontal Reference Grid Lines */}
              <line
                x1={graphData.paddingX}
                y1={graphData.paddingY}
                x2={graphData.width - graphData.paddingX}
                y2={graphData.paddingY}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
              <line
                x1={graphData.paddingX}
                y1={graphData.height / 2}
                x2={graphData.width - graphData.paddingX}
                y2={graphData.height / 2}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
              <line
                x1={graphData.paddingX}
                y1={graphData.height - graphData.paddingY}
                x2={graphData.width - graphData.paddingX}
                y2={graphData.height - graphData.paddingY}
                stroke="currentColor"
                strokeOpacity="0.15"
              />

              {/* Rating Labels */}
              <text
                x={graphData.paddingX - 8}
                y={graphData.paddingY + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {graphData.maxRating}
              </text>
              <text
                x={graphData.paddingX - 8}
                y={graphData.height - graphData.paddingY + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {graphData.minRating}
              </text>

              {/* Rating Polyline */}
              <path
                d={graphData.pathD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {graphData.points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint?.code === pt.code ? 6 : 4}
                  fill={pt.color || "#f59e0b"}
                  stroke="currentColor"
                  strokeWidth={hoveredPoint?.code === pt.code ? 2 : 1}
                  className="cursor-pointer transition-all hover:scale-125"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold text-popover-foreground">{hoveredPoint.name}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Date: {hoveredPoint.dateFormatted}</span>
                  <span>Rank: #{hoveredPoint.rank}</span>
                  <span>
                    Rating: <b style={{ color: hoveredPoint.color }}>{hoveredPoint.rating}</b> (
                    <span
                      className={
                        hoveredPoint.ratingChange >= 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"
                      }
                    >
                      {hoveredPoint.ratingChange >= 0 ? `+${hoveredPoint.ratingChange}` : hoveredPoint.ratingChange}
                    </span>
                    )
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          52-WEEK ACTIVITY HEATMAP (CodeChef Submissions)
         ========================================================================= */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Activity Heatmap</h3>
            <p className="text-xs text-muted-foreground">
              {profile.stats.totalAllTime} total solves recorded
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="rolling">Past 12 Months</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="relative mt-4 overflow-x-auto pb-2">
          {/* Month labels */}
          <div className="flex text-[10px] text-muted-foreground pl-6 mb-1 h-4">
            {monthHeaders.map((m, idx) => (
              <span
                key={idx}
                style={{
                  position: "absolute",
                  left: `${m.weekIndex * 13 + 24}px`,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Day of week labels */}
            <div className="flex flex-col justify-between text-[9px] text-muted-foreground pr-1 h-[88px] select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Weeks columns */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`h-[10px] w-[10px] rounded-xs transition-transform ${getCellColor(
                        day.count,
                        day.isFuture
                      )} ${!day.isFuture ? "hover:scale-125 cursor-pointer" : ""}`}
                      onMouseEnter={(e) => {
                        if (!day.isFuture) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: day.date,
                            count: day.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Hover Day Tooltip */}
          {hoveredCell && (
            <div
              className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md pointer-events-none"
              style={{
                left: `${hoveredCell.x}px`,
                top: `${hoveredCell.y - 6}px`,
              }}
            >
              <b>{hoveredCell.count} solves</b> on {formatDate(hoveredCell.date)}
            </div>
          )}

          {/* Heatmap Footer Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Last year: <b className="text-foreground">{profile.stats.totalLastYear}</b>
              </span>
              <span>
                Last month: <b className="text-foreground">{profile.stats.totalLastMonth}</b>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>Less</span>
              <div className="h-[9px] w-[9px] rounded-xs bg-muted/30 border border-border/30" />
              <div className="h-[9px] w-[9px] rounded-xs bg-amber-800/60" />
              <div className="h-[9px] w-[9px] rounded-xs bg-amber-600" />
              <div className="h-[9px] w-[9px] rounded-xs bg-amber-500" />
              <div className="h-[9px] w-[9px] rounded-xs bg-yellow-400" />
              <span>More</span>
            </div>
          </div>
        </div>
      </section>

      {/* CodeChef Contest Participation Table */}
      <ContestParticipationTable
        contests={ccContestItems}
        title="CodeChef Contest Participation"
        subtitle="Official rated contests recorded on CodeChef for this member"
        emptyMessage="No rated contest participations recorded for CodeChef."
        showPlatform={true}
      />
    </div>
  );
}