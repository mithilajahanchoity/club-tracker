import Link from "next/link";
import type { Profile } from "@/lib/auth";

type MemberRecord = {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  batch: string;
  role: string;
  status: string;
  created_at: string;
};

type LeaderRow = {
  member_id: string;
  member_name: string;
  member_batch: string;
  score: number;
  solved: number;
  contributions: number;
  contests: number;
  active_days: number;
};

type PlatformAccount = {
  platform: string;
  verified: boolean;
};

interface AdvisorDashboardProps {
  profile: Profile;
  allProfiles: MemberRecord[];
  leaderboardRows: LeaderRow[];
  platformAccounts: PlatformAccount[];
}

const platformIcons: Record<string, string> = {
  codeforces: "⚡",
  codechef: "🍳",
  vjudge: "⚖",
  beecrowd: "🐝",
  hackerrank: "💻",
  github: "🐙",
};

const platformNames: Record<string, string> = {
  codeforces: "Codeforces",
  codechef: "CodeChef",
  vjudge: "VJudge",
  beecrowd: "Beecrowd",
  hackerrank: "HackerRank",
  github: "GitHub",
};

export function AdvisorDashboard({
  profile,
  allProfiles,
  leaderboardRows,
  platformAccounts,
}: AdvisorDashboardProps) {
  const approvedMembers = allProfiles.filter(
    (p) => p.status === "approved" && p.role === "member"
  );
  const pendingCount = allProfiles.filter((p) => p.status === "pending").length;
  const suspendedCount = allProfiles.filter((p) => p.status === "suspended").length;

  const activeSolversCount = leaderboardRows.filter((r) => r.score > 0).length;
  const totalSolved7d = leaderboardRows.reduce((acc, r) => acc + Number(r.solved || 0), 0);
  const totalContests7d = leaderboardRows.reduce((acc, r) => acc + Number(r.contests || 0), 0);
  const totalContributions7d = leaderboardRows.reduce(
    (acc, r) => acc + Number(r.contributions || 0),
    0
  );

  const topAchievers = leaderboardRows.slice(0, 5);

  // Group data by batch
  const batchStats: Record<
    string,
    { members: number; active: number; solved: number; score: number }
  > = {};

  for (const m of approvedMembers) {
    const b = m.batch || "Unspecified";
    if (!batchStats[b]) {
      batchStats[b] = { members: 0, active: 0, solved: 0, score: 0 };
    }
    batchStats[b].members++;
  }

  for (const r of leaderboardRows) {
    const b = r.member_batch || "Unspecified";
    if (batchStats[b]) {
      if (r.score > 0) batchStats[b].active++;
      batchStats[b].solved += Number(r.solved || 0);
      batchStats[b].score += Number(r.score || 0);
    }
  }

  const sortedBatches = Object.entries(batchStats).sort((a, b) => b[1].solved - a[1].solved);

  // Platform breakdown
  const platformCounts: Record<string, { total: number; verified: number }> = {};
  for (const a of platformAccounts) {
    if (!platformCounts[a.platform]) {
      platformCounts[a.platform] = { total: 0, verified: 0 };
    }
    platformCounts[a.platform].total++;
    if (a.verified) platformCounts[a.platform].verified++;
  }

  return (
    <div className="space-y-6">
      {/* Advisor Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Advisor Oversight &amp; Analytics</h1>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              🎓 Advisor (Read-only)
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome, <span className="font-medium text-foreground">{profile.full_name}</span> &middot; Faculty &amp;
            mentor academic tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/members"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            👥 Browse Members
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            🏆 Leaderboard
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Students</span>
            <span className="text-lg">👥</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{approvedMembers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Approved club members</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Solvers (7d)</span>
            <span className="text-lg">⚡</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{activeSolversCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedMembers.length > 0
              ? `${Math.round((activeSolversCount / approvedMembers.length) * 100)}% weekly engagement`
              : "0%"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Club Solved (7d)</span>
            <span className="text-lg">🎯</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{totalSolved7d}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalContests7d} contests &middot; {totalContributions7d} GH commits
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Batches</span>
            <span className="text-lg">🏫</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{sortedBatches.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Distinct academic cohorts</p>
        </div>
      </div>

      {/* Main Analytics Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Batch Performance Comparison */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="font-semibold">Batch Performance Comparison</h2>
              <p className="text-xs text-muted-foreground">
                Activity and problems solved by student cohort this week
              </p>
            </div>
          </div>

          {sortedBatches.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-medium">Batch</th>
                    <th className="pb-2 font-medium text-right">Students</th>
                    <th className="pb-2 font-medium text-right">Active (7d)</th>
                    <th className="pb-2 font-medium text-right">Solved (7d)</th>
                    <th className="pb-2 font-medium text-right">Participation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedBatches.map(([batch, stat]) => {
                    const rate =
                      stat.members > 0 ? Math.round((stat.active / stat.members) * 100) : 0;
                    return (
                      <tr key={batch} className="hover:bg-muted/30">
                        <td className="py-2.5 font-medium">Batch {batch}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {stat.members}
                        </td>
                        <td className="py-2.5 text-right font-medium text-foreground">
                          {stat.active}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-primary">
                          {stat.solved}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`rounded px-1.5 py-0.5 font-medium ${
                              rate >= 50
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : rate > 0
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">No batch statistics available yet.</p>
          )}
        </section>

        {/* Right: Top Student Achievers & Platform Insights */}
        <div className="space-y-6">
          {/* Top Achievers */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Top Student Achievers (7-Day Board)</h2>
                <p className="text-xs text-muted-foreground">
                  Highest scoring students over the last 7 days
                </p>
              </div>
              <Link
                href="/leaderboard"
                className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                Leaderboard →
              </Link>
            </div>

            {topAchievers.length > 0 ? (
              <ul className="mt-3 divide-y divide-border">
                {topAchievers.map((row, idx) => (
                  <li key={row.member_id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <div>
                        <Link
                          href={`/members/${row.member_id}`}
                          className="text-sm font-medium hover:text-primary hover:underline transition-colors"
                        >
                          {row.member_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Batch {row.member_batch || "—"} &middot; {row.solved} solved &middot; {row.contests} contests
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-primary">
                      {row.score} pts
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No active leaderboard scores recorded this week yet.
              </p>
            )}
          </section>

          {/* Platform Adoption */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="border-b border-border pb-3">
              <h2 className="font-semibold">Platform Adoption Across Club</h2>
              <p className="text-xs text-muted-foreground">
                Number of member handles connected per platform
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {["codeforces", "hackerrank", "beecrowd", "vjudge", "github"].map((plat) => {
                const stats = platformCounts[plat] || { total: 0, verified: 0 };
                return (
                  <div key={plat} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span>{platformIcons[plat]}</span>
                      <span>{platformNames[plat]}</span>
                    </div>
                    <p className="mt-2 text-xl font-bold">{stats.total}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {stats.verified} verified
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-foreground">Club Status:</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{approvedMembers.length} approved</span>
                <span>&middot;</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{pendingCount} pending</span>
                {suspendedCount > 0 && (
                  <>
                    <span>&middot;</span>
                    <span className="text-muted-foreground">{suspendedCount} suspended</span>
                  </>
                )}
              </div>
              <p>
                <span className="font-medium text-foreground">💡 Mentorship Note:</span> As an Advisor, your
                role provides read-only transparency into club activity. Member approvals and score
                weights are managed by Super Admins.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
