"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateBeecrowdStatsAction } from "@/app/actions/sync";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { BeecrowdPublicProfile } from "@/lib/beecrowd";
import type { DailyActivity } from "@/components/member-platform-stats";

interface BeecrowdProfileViewProps {
  profile: BeecrowdPublicProfile;
  activity: DailyActivity[];
  profileId?: string;
}

export function BeecrowdProfileView({
  profile,
  activity,
  profileId,
}: BeecrowdProfileViewProps) {
  const router = useRouter();
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualSolved, setManualSolved] = useState(String(profile.solvedCount || ""));
  const [manualRank, setManualRank] = useState(
    profile.ranking.replace(/[^0-9]/g, "") || ""
  );
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setIsSavingManual(true);
    setManualFeedback(null);
    try {
      const solvedNum = parseInt(manualSolved, 10);
      const rankNum = manualRank ? parseInt(manualRank, 10) : null;
      const res = await updateBeecrowdStatsAction(profileId, isNaN(solvedNum) ? 0 : solvedNum, rankNum);
      if (res.success) {
        setManualFeedback("Beecrowd stats saved successfully!");
        setShowManualEdit(false);
        router.refresh();
      } else {
        setManualFeedback(res.error || res.message);
      }
    } catch (err: unknown) {
      setManualFeedback(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingManual(false);
    }
  }
  // 1. Radar chart data for Problems by category
  const radarData = useMemo(() => {
    return [
      { category: "Beginner", solved: profile.categorySolved.Beginner },
      { category: "Ad-Hoc", solved: profile.categorySolved["Ad-Hoc"] },
      { category: "String", solved: profile.categorySolved.String },
      { category: "Data Structures", solved: profile.categorySolved["Data Structures"] },
      { category: "Mathematics", solved: profile.categorySolved.Mathematics },
      { category: "Paradigms", solved: profile.categorySolved.Paradigms },
      { category: "Graph", solved: profile.categorySolved.Graph },
      { category: "Geometry", solved: profile.categorySolved.Geometry },
      { category: "SQL", solved: profile.categorySolved.SQL },
    ];
  }, [profile.categorySolved]);

  const maxCategorySolved = Math.max(1, ...radarData.map((d) => d.solved));

  // 2. Beecrowd 6-Month Purple Progress Calendar Grid (Image 1)
  const sixMonthsProgress = useMemo(() => {
    const months = [];
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 3600000);

    // Map daily activity
    const activityMap = new Map<string, number>();
    for (const a of activity) {
      if (a.platform === "beecrowd") {
        activityMap.set(a.activity_date, a.solved || 0);
      }
    }

    // Merge real profile activity dates extracted from Beecrowd HTML (cal.init)
    if (profile.activityDates) {
      for (const [dStr, count] of Object.entries(profile.activityDates)) {
        activityMap.set(dStr, Math.max(activityMap.get(dStr) ?? 0, count));
      }
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(bdNow.getFullYear(), bdNow.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const monthName = monthNames[monthIndex];

      const days = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const solved = activityMap.get(dStr) ?? 0;
        days.push({ day, date: dStr, solved });
      }

      months.push({ name: monthName, year, days });
    }

    return months;
  }, [activity, profile.activityDates]);

  // Purple color intensity scale (Beecrowd branding)
  const getPurpleCellClass = (solved: number) => {
    if (solved === 0) return "bg-muted/40 dark:bg-muted/20 border border-border/20";
    if (solved === 1) return "bg-purple-300 dark:bg-purple-800";
    if (solved <= 3) return "bg-purple-400 dark:bg-purple-600";
    if (solved <= 6) return "bg-purple-500 dark:bg-purple-500";
    return "bg-purple-700 dark:bg-purple-400";
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Profile Banner (Matches Screenshot Image 3) */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* User Avatar */}
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-border bg-muted flex items-center justify-center shadow-inner">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl">🐝</span>
              )}
            </div>

            {/* User Title & Badges */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {profile.username}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <span>👤</span>
                  <span>ID: {profile.userId}</span>
                </span>
                <a
                  href={`https://judge.beecrowd.com/en/profile/${profile.userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  judge.beecrowd.com ↗
                </a>
                {profileId && (
                  <button
                    type="button"
                    onClick={() => setShowManualEdit(!showManualEdit)}
                    className="rounded-full border border-purple-300 bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
                  >
                    ✏️ {showManualEdit ? "Close Editor" : "Set Solved Count"}
                  </button>
                )}
              </div>

              {/* Ranking & Points Badges (Matching Screenshot 3) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-xs">
                  <span className="text-base text-purple-600">🏆</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ranking</p>
                    <p className="font-bold text-foreground">{profile.ranking}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-xs">
                  <span className="text-base text-purple-600">📈</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Points</p>
                    <p className="font-bold text-foreground">{profile.points}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                  <span>📅 Joined: <span className="font-medium text-foreground">{profile.joinedDate}</span></span>
                </div>
              </div>
            </div>
          </div>

          <span className="rounded-lg bg-purple-900 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            UTC
          </span>
        </div>

        {/* Inline Manual Solved Editor */}
        {showManualEdit && profileId && (
          <form
            onSubmit={handleManualSubmit}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/40"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Solved Count <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={manualSolved}
                onChange={(e) => setManualSolved(e.target.value)}
                placeholder="e.g. 53"
                className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Rank (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={manualRank}
                onChange={(e) => setManualRank(e.target.value)}
                placeholder="e.g. 1420"
                className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingManual}
              className="rounded-lg bg-purple-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSavingManual ? "Saving..." : "Save Solves & Generate Charts"}
            </button>

            {manualFeedback && (
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium self-center">
                {manualFeedback}
              </span>
            )}
          </form>
        )}

        {/* Cloudflare Notice when Solved Count is 0 */}
        {profile.solvedCount === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <span className="text-base">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold">Beecrowd Automated Crawl Protection (Cloudflare)</p>
                <p className="text-[11px] leading-relaxed opacity-95">
                  Beecrowd protects its public profile pages with Cloudflare bot checks, which blocks direct server-side scrapers by default.
                  You can set <code className="rounded bg-amber-200/70 px-1 py-0.5 font-mono font-bold dark:bg-amber-900">BEECROWD_COOKIE</code> in your <code className="font-mono">.env.local</code>, or click <strong>&quot;Set Solved Count&quot;</strong> above to enter your current solves and immediately generate all charts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* About & Motto */}
        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 text-xs">
          <div>
            <h3 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[11px]">About</h3>
            <p className="text-foreground">{profile.about}</p>
          </div>
          <div>
            <h3 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[11px]">Motto</h3>
            <p className="text-foreground">{profile.motto}</p>
          </div>
        </div>

        {/* 3 Large Stat Cards (Submissions, Solved, Hardest Solved) */}
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <span className="text-3xl text-rose-500">🧩</span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Submissions</p>
              <p className="text-2xl font-bold text-foreground">{profile.submissionsCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <span className="text-3xl text-amber-500">💡</span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Solved</p>
              <p className="text-2xl font-bold text-foreground">{profile.solvedCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <span className="text-3xl text-emerald-500">🚩</span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Hardest Solved</p>
              <p className="text-2xl font-bold text-foreground">{profile.hardestSolved}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Progress Section (6-Month Calendar Blocks with Purple Scale - Matches Screenshot Image 1) */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-base font-semibold">Progress</h2>
            <p className="text-xs text-muted-foreground">
              Month-by-month activity breakdown on Beecrowd
            </p>
          </div>
        </div>

        {/* 6 Month Mini-Grid Blocks */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-4 min-w-[700px]">
            {sixMonthsProgress.map((m) => (
              <div key={`${m.name}-${m.year}`} className="flex-1 space-y-2 text-center">
                <div className="grid grid-cols-7 gap-1 p-2 rounded-xl bg-muted/20 border border-border/40">
                  {m.days.map((d) => (
                    <div
                      key={d.date}
                      className={`h-2.5 w-2.5 rounded-[2px] transition-transform hover:scale-125 ${getPurpleCellClass(
                        d.solved
                      )}`}
                      title={`${d.date}: ${d.solved} problems solved`}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-muted-foreground">{m.name}</p>
              </div>
            ))}

            {/* Vertical Purple Legend Bar (Matching Image 1) */}
            <div className="flex flex-col items-center justify-between h-20 pl-2">
              <div className="flex flex-col gap-0.5">
                <span className="h-2 w-2 rounded-[1px] bg-purple-200 dark:bg-purple-900" />
                <span className="h-2 w-2 rounded-[1px] bg-purple-300 dark:bg-purple-800" />
                <span className="h-2 w-2 rounded-[1px] bg-purple-400 dark:bg-purple-600" />
                <span className="h-2 w-2 rounded-[1px] bg-purple-500 dark:bg-purple-500" />
                <span className="h-2 w-2 rounded-[1px] bg-purple-600 dark:bg-purple-400" />
                <span className="h-2 w-2 rounded-[1px] bg-purple-800 dark:bg-purple-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Submissions by Answer & Submissions by Language (Matches Screenshot Image 1) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Submissions by answer Donut Chart */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Submissions by answer</h2>
          {profile.submissionsByAnswer.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={profile.submissionsByAnswer}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                    >
                      {profile.submissionsByAnswer.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs">
                {profile.submissionsByAnswer.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-mono font-medium ml-auto pl-2 text-foreground">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
              No submission verdicts recorded yet
            </div>
          )}
        </section>

        {/* Submissions by language Donut Chart */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Submissions by language</h2>
          {profile.submissionsByLanguage.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={profile.submissionsByLanguage}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                    >
                      {profile.submissionsByLanguage.map((entry, index) => (
                        <Cell key={`lang-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs">
                {profile.submissionsByLanguage.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-mono font-medium ml-auto pl-2 text-foreground">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
              No language breakdown recorded yet
            </div>
          )}
        </section>
      </div>

      {/* 4. Problems by category & Progress (past 6 months) (Matches Screenshot Image 2) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Problems by category Radar/Spider Chart */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold">Problems by category</h2>
            <p className="text-xs text-muted-foreground">
              Solved distribution across Beecrowd domains
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" strokeOpacity={0.7} />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, maxCategorySolved]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                />
                <Radar
                  name="Solved"
                  dataKey="solved"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.25}
                  dot={{ r: 3, fill: "#ef4444" }}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Progress (past 6 months) Line Chart */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold">Progress (past 6 months)</h2>
            <p className="text-xs text-muted-foreground">
              Cumulative solved trend over the last 6 months
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profile.monthlyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  domain={[0, Math.max(1, profile.solvedCount)]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Solved"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#14b8a6" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
