import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { SyncPlatformButton } from "@/components/sync-platform-button";
import type { Profile } from "@/lib/auth";

type PlatformAccount = {
  platform: string;
  handle: string;
  verified: boolean;
  last_synced_at: string | null;
};

type LeaderRow = {
  member_id: string;
  score: number;
  solved: number;
  contributions: number;
  contests: number;
  active_days: number;
};

type DailyActivity = {
  activity_date: string;
  solved: number;
  commits: number;
};

interface MemberDashboardProps {
  profile: Profile;
  accounts: PlatformAccount[];
  leaderboardRows: LeaderRow[];
  activityRows: DailyActivity[];
  dayDates: string[];
}

const platformLabels: Record<string, string> = {
  codeforces: "Codeforces",
  codechef: "CodeChef",
  vjudge: "VJudge",
  beecrowd: "Beecrowd",
  hackerrank: "HackerRank",
  github: "GitHub",
};

const platformIcons: Record<string, string> = {
  codeforces: "⚡",
  codechef: "🍳",
  vjudge: "⚖",
  beecrowd: "🐝",
  hackerrank: "💻",
  github: "🐙",
};

const platformUrls: Record<string, (handle: string) => string> = {
  codeforces: (h) => `https://codeforces.com/profile/${h}`,
  hackerrank: (h) => `https://www.hackerrank.com/profile/${h}`,
  beecrowd: (h) => `https://judge.beecrowd.com/en/profile/${h}`,
  github: (h) => `https://github.com/${h}`,
  codechef: (h) => `https://www.codechef.com/users/${h}`,
  vjudge: (h) => `https://vjudge.net/user/${h}`,
};

export function MemberDashboard({
  profile,
  accounts,
  leaderboardRows,
  activityRows,
  dayDates,
}: MemberDashboardProps) {
  const myIndex = leaderboardRows.findIndex((r) => r.member_id === profile.id);
  const myRow = myIndex >= 0 ? leaderboardRows[myIndex] : null;
  const myRank =
    myIndex >= 0
      ? leaderboardRows.findIndex((r) => r.score === leaderboardRows[myIndex].score) + 1
      : null;

  // Compute 14-day activity chart data
  const activityMap = new Map<string, { solved: number; commits: number }>();
  for (const r of activityRows) {
    const existing = activityMap.get(r.activity_date) ?? { solved: 0, commits: 0 };
    existing.solved += r.solved || 0;
    existing.commits += r.commits || 0;
    activityMap.set(r.activity_date, existing);
  }

  const days = dayDates.map((d) => {
    const act = activityMap.get(d) ?? { solved: 0, commits: 0 };
    return {
      date: d,
      solved: act.solved,
      commits: act.commits,
      total: act.solved + act.commits,
    };
  });

  const totalSolved14d = days.reduce((acc, d) => acc + d.solved, 0);
  const totalCommits14d = days.reduce((acc, d) => acc + d.commits, 0);
  const maxDaily = Math.max(...days.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {profile.full_name.split(" ")[0]} 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {profile.student_id} &middot; Batch {profile.batch || "—"} &middot; Club Member
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            👤 My Profile
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            🏆 Leaderboard →
          </Link>
        </div>
      </div>

      {/* Personal Rank & Points Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {myRank !== null && myRow ? (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground">This week&apos;s rank</p>
                <span className="text-xl">🏆</span>
              </div>
              <p className="mt-2 text-3xl font-bold">#{myRank}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                of {leaderboardRows.length} active members
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground">Points</p>
                <span className="text-xl">⚡</span>
              </div>
              <p className="mt-2 text-3xl font-bold">{myRow.score}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">last 7 days total</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground">Solved Challenges</p>
                <span className="text-xl">🎯</span>
              </div>
              <p className="mt-2 text-3xl font-bold">{myRow.solved}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {myRow.active_days} active days this week
              </p>
            </div>
          </>
        ) : (
          <div className="sm:col-span-3 flex items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <p className="font-medium text-foreground">You&apos;re not on this week&apos;s leaderboard yet.</p>
                <p className="text-xs text-muted-foreground">
                  Solve problems on Codeforces, HackerRank, or Beecrowd, or push code on GitHub to start earning points!
                </p>
              </div>
            </div>
            <Link
              href="/leaderboard"
              className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Check Board
            </Link>
          </div>
        )}
      </div>

      {/* Connected Platform Usernames */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-semibold text-sm">Connected Platform Accounts</h2>
            <p className="text-xs text-muted-foreground">
              Syncing your competitive programming activity automatically
            </p>
          </div>
          <Link
            href="/profile"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Manage Handles →
          </Link>
        </div>

        {accounts && accounts.length > 0 ? (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li
                key={a.platform}
                className="flex items-center justify-between gap-2 px-5 py-3.5 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{platformIcons[a.platform] ?? "🔗"}</span>
                  <div>
                    <span className="font-medium">
                      {platformLabels[a.platform] ?? a.platform}
                    </span>
                    <span className="mx-1.5 text-muted-foreground">&middot;</span>
                    {platformUrls[a.platform] ? (
                      <a
                        href={platformUrls[a.platform](a.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors inline-flex items-center gap-0.5"
                        title={`Open ${platformLabels[a.platform] ?? a.platform} profile`}
                      >
                        <span>{a.handle}</span>
                        <span className="text-[10px] opacity-70">↗</span>
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{a.handle}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {a.verified ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5">Unverified</span>
                  )}
                  <span className="hidden sm:inline">
                    {a.platform === "codeforces" ||
                    a.platform === "github" ||
                    a.platform === "beecrowd" ||
                    a.platform === "hackerrank" ||
                    a.platform === "vjudge"
                      ? a.last_synced_at
                        ? `synced ${formatDateTime(a.last_synced_at)}`
                        : "waiting for first sync"
                      : "sync coming soon"}
                  </span>
                  <SyncPlatformButton
                    profileId={profile.id}
                    platform={a.platform}
                    platformName={platformLabels[a.platform] ?? a.platform}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="text-2xl mb-2">🔗</p>
            <p className="font-medium text-foreground">No platform usernames connected yet.</p>
            <p className="mt-1 text-xs">Add your handles to start tracking solved problems and contests.</p>
            <Link
              href="/profile"
              className="mt-3 inline-block rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Add Handles in Profile →
            </Link>
          </div>
        )}
      </section>

      {/* Personal Activity Window (Last 14 Days) */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-sm">Your Recent Activity (Last 14 Days)</h2>
          <p className="text-xs text-muted-foreground">
            {totalSolved14d} problems solved &middot; {totalCommits14d} GitHub contributions
          </p>
        </div>

        {totalSolved14d + totalCommits14d > 0 ? (
          <>
            <div className="flex h-24 items-end gap-1.5 pt-2">
              {days.map((d) => (
                <div key={d.date} className="group relative flex-1" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-sm bg-primary/70 transition-all group-hover:bg-primary"
                    style={{ height: `${Math.max(6, (d.total / maxDaily) * 100)}%` }}
                    title={`${d.date}: ${d.solved} solved, ${d.commits} contributions`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{days[0].date.slice(5)}</span>
              <span>{days[6].date.slice(5)}</span>
              <span>{days[13].date.slice(5)}</span>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center text-xs text-muted-foreground">
            <p className="text-xl mb-1">📈</p>
            <p>No activity logged yet in the last 14 days.</p>
            <p className="mt-0.5">Solve a problem on HackerRank, Beecrowd, or Codeforces to light up your activity chart!</p>
          </div>
        )}
      </section>
    </div>
  );
}
