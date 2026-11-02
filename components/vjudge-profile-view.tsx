"use client";

import { useState, useMemo } from "react";
import type { VJudgePublicProfile } from "@/lib/vjudge";

interface VJudgeProfileViewProps {
  profile: VJudgePublicProfile;
  profileId?: string;
}

const vjudgeMonths = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

export function VJudgeProfileView({ profile }: VJudgeProfileViewProps) {
  // Available years from yearlyCounts or activityMap
  const yearsList = useMemo(() => {
    const list = Object.keys(profile.yearlyCounts).sort((a, b) => b.localeCompare(a));
    if (list.length === 0) {
      list.push(String(new Date().getFullYear()));
    }
    return list;
  }, [profile.yearlyCounts]);

  const [selectedYear, setSelectedYear] = useState<string>(
    yearsList.includes("2024") ? "2024" : yearsList[0] || "2024"
  );

  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // 52-Week Grid for the Selected Year (Jan 1 to Dec 31)
  const { weeks, monthHeaders } = useMemo(() => {
    const yr = parseInt(selectedYear, 10) || new Date().getFullYear();
    const startOfYear = new Date(Date.UTC(yr, 0, 1));
    const dayOfWeek = (startOfYear.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
    const startMs = startOfYear.getTime() - dayOfWeek * 86400000;
    const totalWeeks = 53;

    const weeksArr: Array<
      Array<{
        date: string;
        count: number;
        isCurrentYear: boolean;
      }>
    > = [];

    const headers: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays: Array<{
        date: string;
        count: number;
        isCurrentYear: boolean;
      }> = [];

      for (let d = 0; d < 7; d++) {
        const curMs = startMs + (w * 7 + d) * 86400000;
        const curDate = new Date(curMs);
        const curDateStr = curDate.toISOString().slice(0, 10);
        const count = profile.activityMap[curDateStr] ?? 0;
        const isCurrentYear = curDate.getUTCFullYear() === yr;

        weekDays.push({
          date: curDateStr,
          count,
          isCurrentYear,
        });

        if (d === 0) {
          const m = curDate.getUTCMonth();
          if (m !== lastMonth && isCurrentYear) {
            headers.push({ weekIndex: w, label: vjudgeMonths[m] });
            lastMonth = m;
          }
        }
      }
      weeksArr.push(weekDays);
    }

    return { weeks: weeksArr, monthHeaders: headers };
  }, [profile.activityMap, selectedYear]);

  // VJudge Green Color Scale
  const getVJudgeCellColor = (count: number, isCurrentYear: boolean) => {
    if (!isCurrentYear) return "bg-transparent opacity-0 pointer-events-none";
    if (count === 0) return "bg-[#252c37] border border-[#2f3946]";
    if (count <= 2) return "bg-[#18632e]"; // Darker green
    if (count <= 5) return "bg-[#218838]"; // Medium green
    if (count <= 10) return "bg-[#2ecc71]"; // Vibrant green
    return "bg-[#38d39f]"; // Brightest green (e.g. 15 AC on Monday Apr 1)
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP CARD: VJudge User Profile Banner (Matches Screenshot Top Panel)
         ========================================================================= */}
      <section className="rounded-2xl border border-[#2d3748] bg-[#181d24] p-5 md:p-6 text-zinc-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          {/* Left: Avatar + Handle + Name */}
          <div className="flex items-center gap-4">
            {/* Square 3D Button-Style Avatar (Matches Screenshot Sunglasses Avatar) */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-500/70 bg-[#2b3340] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.4)]">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatarUrl}
                  alt={profile.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-400 text-2xl shadow-inner">
                  😎
                </div>
              )}
            </div>

            {/* Handle & Name */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {profile.handle}
                </h2>
                <a
                  href={`https://vjudge.net/user/${profile.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 transition-colors hover:text-white"
                  title="Open VJudge profile"
                >
                  <span className="text-xs">↗</span>
                </a>
              </div>
              <p className="text-sm font-medium text-zinc-400 mt-0.5">{profile.name}</p>
            </div>
          </div>

          {/* Right: 3 Metric Cards (Rank, Solved, Attempted) + Sub-row */}
          <div className="flex flex-col items-start sm:items-end">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. Rank Card (Amber) */}
              <div className="min-w-[85px] rounded-xl border border-[#3b4758] bg-[#222933]/90 px-4 py-2 text-center shadow-xs">
                <p className="text-lg font-bold text-[#f59e0b] leading-tight">{profile.rank}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Rank</p>
              </div>

              {/* 2. Solved Card (Cyan / Blue) */}
              <div className="min-w-[85px] rounded-xl border border-[#3b4758] bg-[#222933]/90 px-4 py-2 text-center shadow-xs">
                <p className="text-lg font-bold text-[#38bdf8] leading-tight">{profile.solvedCount}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Solved</p>
              </div>

              {/* 3. Attempted Card (Lavender / Soft Purple) */}
              <div className="min-w-[85px] rounded-xl border border-[#3b4758] bg-[#222933]/90 px-4 py-2 text-center shadow-xs">
                <p className="text-lg font-bold text-[#a5b4fc] leading-tight">{profile.attemptedCount}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Attempted</p>
              </div>
            </div>

            {/* Sub-row links and velocity counters */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span className="cursor-pointer hover:text-zinc-200 transition-colors">
                Export AC / All
              </span>
              <span>&middot;</span>
              <span className="cursor-pointer hover:text-zinc-200 transition-colors">
                Show details
              </span>
              <span>&middot;</span>
              <span>{profile.ac1d} / Day</span>
              <span>&middot;</span>
              <span>{profile.ac7d} / Week</span>
              <span>&middot;</span>
              <span>{profile.ac30d} / Month</span>
            </div>
          </div>
        </div>

        {/* Bottom Fact Strip (Register, Last seen, School, Email) */}
        <div className="mt-6 border-t border-[#2d3748] pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            {/* Register */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                REGISTER
              </p>
              <p className="mt-0.5 font-medium text-zinc-200">{profile.registerTime}</p>
            </div>

            {/* Last Seen */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                LAST SEEN
              </p>
              <p className="mt-0.5 font-medium text-zinc-200">{profile.lastSeen}</p>
            </div>

            {/* School */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                SCHOOL
              </p>
              <p className="mt-0.5 font-medium text-zinc-200 truncate" title={profile.school}>
                {profile.school}
              </p>
            </div>

            {/* Email */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                EMAIL
              </p>
              <p className="mt-0.5 font-medium text-zinc-200 flex items-center gap-1.5 truncate">
                <span className="truncate">{profile.email || "—"}</span>
                {profile.email && <span className="text-emerald-500 font-bold">✔</span>}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BOTTOM CARD: VJudge Activity Calendar Heatmap (Matches Screenshot Bottom Panel)
         ========================================================================= */}
      <section className="rounded-2xl border border-[#2d3748] bg-[#181d24] p-5 md:p-6 text-zinc-200 shadow-sm space-y-5">
        {/* Header Row: Title & Year Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">Activity</h3>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Select year for VJudge activity"
            className="rounded-lg border border-[#3b4758] bg-[#222933] px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-xs outline-none transition-colors hover:border-[#4d5c70]"
          >
            {yearsList.map((yr) => (
              <option key={yr} value={yr}>
                {yr} ({profile.yearlyCounts[yr] ?? 0})
              </option>
            ))}
          </select>
        </div>

        {/* Calendar Heatmap Grid */}
        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[760px] select-none">
            {/* Month Labels along top (Uppercase: JAN, FEB, MAR, APR, etc.) */}
            <div className="flex text-[11px] font-medium text-zinc-400 mb-1.5 pl-10">
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
              {/* Day Labels on Left (MON, WED, FRI, SUN matching VJudge) */}
              <div className="flex flex-col justify-between text-[10px] font-semibold text-zinc-400 pr-2 w-10 h-[98px] py-0.5">
                <span>MON</span>
                <span className="text-transparent select-none">TUE</span>
                <span>WED</span>
                <span className="text-transparent select-none">THU</span>
                <span>FRI</span>
                <span className="text-transparent select-none">SAT</span>
                <span>SUN</span>
              </div>

              {/* 52 Columns of 7 Squares */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        className={`h-[11px] w-[11px] rounded-[1px] transition-transform hover:scale-125 cursor-pointer ${getVJudgeCellColor(
                          day.count,
                          day.isCurrentYear
                        )}`}
                        onMouseEnter={(e) => {
                          if (!day.isCurrentYear) return;
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
                className="fixed z-50 rounded bg-zinc-950 px-2.5 py-1 text-xs font-medium text-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full mb-1 border border-zinc-700"
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
      </section>
    </div>
  );
}

