import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { decideMember } from "@/app/admin/approvals/actions";
import { PlatformIcon } from "@/components/platform-icon";
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

type ScoreSettings = {
  points_per_solved: number;
  points_per_contest: number;
  points_per_contribution: number;
  contribution_daily_cap: number;
  points_per_active_day: number;
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

type AuditLog = {
  id: number;
  action: string;
  target_id: string | null;
  details: unknown;
  created_at: string;
  actor_id: string | null;
};

type PlatformAccount = {
  platform: string;
  verified: boolean;
  last_synced_at: string | null;
};

interface SuperAdminDashboardProps {
  profile: Profile;
  pendingMembers: MemberRecord[];
  allProfiles: MemberRecord[];
  leaderboardRows: LeaderRow[];
  scoreSettings: ScoreSettings | null;
  recentAuditLogs: AuditLog[];
  platformAccounts: PlatformAccount[];
}

const auditLabels: Record<string, string> = {
  member_approved: "Approved member signup",
  member_rejected: "Rejected member signup",
  score_settings_updated: "Updated scoring weights",
  member_make_advisor: "Promoted member to Advisor",
  member_make_member: "Changed role to Member",
  member_suspend: "Suspended member account",
  member_reactivate: "Reactivated member account",
};

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

export function SuperAdminDashboard({
  profile,
  pendingMembers,
  allProfiles,
  leaderboardRows,
  scoreSettings,
  recentAuditLogs,
  platformAccounts,
}: SuperAdminDashboardProps) {
  const approvedMembers = allProfiles.filter(
    (p) => p.status === "approved" && p.role === "member"
  );
  const activeSolversCount = leaderboardRows.filter((r) => r.score > 0).length;
  const totalSolved7d = leaderboardRows.reduce((acc, r) => acc + Number(r.solved || 0), 0);
  const totalContests7d = leaderboardRows.reduce((acc, r) => acc + Number(r.contests || 0), 0);
  const topPerformers = leaderboardRows.slice(0, 5);

  // Group approved members by batch
  const batchCounts: Record<string, number> = {};
  for (const p of approvedMembers) {
    const b = p.batch || "Unspecified";
    batchCounts[b] = (batchCounts[b] || 0) + 1;
  }
  const sortedBatches = Object.entries(batchCounts).sort((a, b) => b[1] - a[1]);

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
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Super Admin Operations</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              🛡️ Super Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{profile.full_name}</span> &middot; Full
            administrative control &amp; club oversight
          </p>
        </div>

        {/* Quick Nav Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/approvals"
            className="relative inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <span>Approvals Queue</span>
            {pendingMembers.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                {pendingMembers.length}
              </span>
            )}
          </Link>
          <Link
            href="/admin/score"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            ⚙️ Scoring Rules
          </Link>
          <Link
            href="/members"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            👥 Member Directory
          </Link>
        </div>
      </div>

      {/* Critical Approvals Alert */}
      {pendingMembers.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-5 dark:border-amber-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs">
                ⚠️
              </span>
              <h2 className="font-semibold text-amber-900 dark:text-amber-200">
                Action Required: {pendingMembers.length} application{pendingMembers.length > 1 ? "s" : ""} waiting for approval
              </h2>
            </div>
            <Link
              href="/admin/approvals"
              className="text-xs font-semibold text-amber-900 underline underline-offset-4 hover:opacity-80 dark:text-amber-300"
            >
              View all pending ({pendingMembers.length}) →
            </Link>
          </div>

          <ul className="mt-3 divide-y divide-amber-500/10">
            {pendingMembers.slice(0, 3).map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm first:pt-1 last:pb-0"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span>{m.full_name}</span>
                    {m.role === "advisor" ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        🎓 Advisor
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">({m.student_id})</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.role === "advisor"
                      ? `${m.batch ? m.batch + " · " : ""}${m.email} · Applied ${formatDate(m.created_at)}`
                      : `Batch ${m.batch || "—"} · ${m.email} · Applied ${formatDate(m.created_at)}`}
                  </p>
                </div>
                <form action={decideMember} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    name="decision"
                    value="approved"
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 dark:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="rejected"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    Reject
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="font-medium">
              Approvals Queue Clear: All pending member applications have been reviewed.
            </span>
          </div>
          <Link href="/admin/approvals" className="underline underline-offset-2 hover:opacity-80">
            View queue
          </Link>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Approvals</span>
            <span className="text-lg">⏳</span>
          </div>
          <p
            className={`mt-2 text-3xl font-bold ${
              pendingMembers.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {pendingMembers.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingMembers.length > 0 ? "Awaiting review" : "All caught up"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Approved Members</span>
            <span className="text-lg">👥</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{approvedMembers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {allProfiles.length} total registered accounts
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Solvers (7d)</span>
            <span className="text-lg">⚡</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{activeSolversCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedMembers.length > 0
              ? `${Math.round((activeSolversCount / approvedMembers.length) * 100)}% club participation`
              : "No members yet"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Club Solved (7d)</span>
            <span className="text-lg">🎯</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{totalSolved7d}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalContests7d} rated contest entries
          </p>
        </div>
      </div>

      {/* Main Two-Column Operations Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Management & Audit Trail */}
        <div className="space-y-6">
          {/* Scoring Rules Engine Card */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Scoring Weights Engine</h2>
                <p className="text-xs text-muted-foreground">
                  Active point rules applied to the club leaderboard
                </p>
              </div>
              <Link
                href="/admin/score"
                className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                Edit Weights →
              </Link>
            </div>

            {scoreSettings ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Solved Problem</span>
                  <p className="mt-1 text-lg font-bold">+{scoreSettings.points_per_solved} pts</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Rated Contest</span>
                  <p className="mt-1 text-lg font-bold">+{scoreSettings.points_per_contest} pts</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">GitHub Commit</span>
                  <p className="mt-1 text-lg font-bold">+{scoreSettings.points_per_contribution} pts</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Daily Commit Cap</span>
                  <p className="mt-1 text-lg font-bold">{scoreSettings.contribution_daily_cap}/day</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="text-xs text-muted-foreground">Active Day</span>
                  <p className="mt-1 text-lg font-bold">+{scoreSettings.points_per_active_day} pts</p>
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-3 text-center">
                  <Link
                    href="/admin/score"
                    className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Adjust values
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No scoring settings configured.</p>
            )}
          </section>

          {/* Platform Accounts Health */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Platform Integration Status</h2>
                <p className="text-xs text-muted-foreground">
                  Synchronized competitive programming platforms
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["codeforces", "hackerrank", "beecrowd", "github"].map((plat) => {
                const stats = platformCounts[plat] || { total: 0, verified: 0 };
                return (
                  <div key={plat} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <PlatformIcon platform={plat} className="h-4 w-4 shrink-0" fallback={platformIcons[plat]} />
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
          </section>

          {/* System Audit Trail */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Recent Administrative Activity</h2>
                <p className="text-xs text-muted-foreground">System audit log events</p>
              </div>
            </div>

            {recentAuditLogs.length > 0 ? (
              <ul className="mt-3 divide-y divide-border text-xs">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between py-2.5">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">
                        {auditLabels[log.action] ?? log.action}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {log.action}
                      </p>
                    </div>
                    <span className="text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">No recent audit log entries.</p>
            )}
          </section>
        </div>

        {/* Right Column: Leaderboard Snapshot & Cohort Breakdown */}
        <div className="space-y-6">
          {/* Top Performers (7-Day Board) */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Top Performers This Week</h2>
                <p className="text-xs text-muted-foreground">
                  Last 7 days leaderboard leaders
                </p>
              </div>
              <Link
                href="/leaderboard"
                className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                Full Board →
              </Link>
            </div>

            {topPerformers.length > 0 ? (
              <ul className="mt-3 divide-y divide-border">
                {topPerformers.map((row, idx) => (
                  <li key={row.member_id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold">
                        #{idx + 1}
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
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-primary">
                        {row.score} pts
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active leaderboard scores recorded this week yet.
              </div>
            )}
          </section>

          {/* Batch Representation */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-semibold">Approved Members by Batch</h2>
                <p className="text-xs text-muted-foreground">
                  Student distribution across cohorts
                </p>
              </div>
              <Link
                href="/members"
                className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                Manage members
              </Link>
            </div>

            {sortedBatches.length > 0 ? (
              <div className="mt-4 space-y-3">
                {sortedBatches.map(([batch, count]) => {
                  const percentage = Math.round((count / approvedMembers.length) * 100);
                  return (
                    <div key={batch} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Batch {batch}</span>
                        <span className="text-muted-foreground">
                          {count} member{count > 1 ? "s" : ""} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">No approved members registered yet.</p>
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
                      <PlatformIcon platform={plat} className="h-4 w-4 shrink-0" fallback={platformIcons[plat]} />
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
          </section>
        </div>
      </div>
    </div>
  );
}
