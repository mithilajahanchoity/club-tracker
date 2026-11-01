import { Suspense } from "react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { formatDateTime } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
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

async function DashboardContent() {
  const { user, profile } = await requireApproved();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("platform_accounts")
    .select("platform, handle, verified, last_synced_at")
    .eq("profile_id", user.id)
    .order("platform");

  // This week's rank
  const { data: board } = await supabase.rpc("leaderboard", { p_days: 7 });
  const rows = ((board ?? []) as { member_id: string; score: number }[]);
  const myIndex = rows.findIndex((r) => r.member_id === user.id);
  const myRank =
    myIndex >= 0
      ? rows.findIndex((r) => r.score === rows[myIndex].score) + 1
      : null;

  const roleLabel = profile.role.replace("_", " ");

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Hello, {profile.full_name.split(" ")[0]} 👋
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile.student_id} &middot; Batch {profile.batch} &middot;{" "}
              <span className="capitalize">{roleLabel}</span>
            </p>
          </div>
        </div>

        {/* Rank card */}
        <div className="grid gap-4 sm:grid-cols-3">
          {myRank !== null ? (
            <>
              <StatCard
                label="This week's rank"
                value={`#${myRank}`}
                sub={`of ${rows.length} members`}
                icon="🏆"
              />
              <StatCard
                label="Points"
                value={String(rows[myIndex].score)}
                sub="last 7 days"
                icon="⚡"
              />
            </>
          ) : (
            <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <span className="text-2xl">📊</span>
              <span>You&apos;re not on this week&apos;s leaderboard yet. Start solving problems!</span>
            </div>
          )}
          <Link
            href="/leaderboard"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            View leaderboard →
          </Link>
        </div>

        {/* Platform accounts */}
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Platform usernames</h2>
          </div>
          {accounts && accounts.length > 0 ? (
            <ul className="divide-y divide-border">
              {accounts.map((a) => (
                <li
                  key={a.platform}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {platformIcons[a.platform] ?? "🔗"}
                    </span>
                    <div>
                      <span className="font-medium">
                        {platformLabels[a.platform] ?? a.platform}
                      </span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="font-mono text-xs">{a.handle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {a.verified ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        Unverified
                      </span>
                    )}
                    <span className="hidden sm:inline">
                      {a.platform === "codeforces" ||
                      a.platform === "github" ||
                      a.platform === "beecrowd"
                        ? a.last_synced_at
                          ? `synced ${formatDateTime(a.last_synced_at)}`
                          : "waiting for first sync"
                        : "sync coming soon"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p className="text-2xl mb-2">🔗</p>
              <p>No platform usernames added yet.</p>
              <p className="mt-1 text-xs">They were set during signup and can be updated by an admin.</p>
            </div>
          )}
        </section>

        {/* Activity placeholder */}
        <section className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          <p className="text-xl mb-1">📈</p>
          <p>Activity charts will appear here after platform syncing is set up.</p>
        </section>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
