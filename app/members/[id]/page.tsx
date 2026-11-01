import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppNav } from "@/components/app-nav";
import { formatDate, formatDateTime } from "@/lib/format";
import { changeMember } from "./actions";

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

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function getActivityWindow() {
  const DAY = 86400000;
  const BD = 6 * 3600000;
  const now = Date.now();
  const since = new Date(now + BD - 13 * DAY).toISOString().slice(0, 10);
  const dayDates = Array.from({ length: 14 }, (_, i) =>
    new Date(now + BD - (13 - i) * DAY).toISOString().slice(0, 10)
  );
  return { since, dayDates };
}

export default function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense>
      <MemberContent params={params} />
    </Suspense>
  );
}

async function MemberContent({ params }: { params: Promise<{ id: string }> }) {
  const { user, profile: me } = await requireStaff();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, student_id, batch, contact, role, status, consent_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!member) notFound();

  const { data: overview } = await supabase.rpc("staff_member_overview");
  const lastSignIn =
    ((overview ?? []) as { id: string; last_sign_in_at: string | null }[]).find(
      (r) => r.id === id
    )?.last_sign_in_at ?? null;

  const { since, dayDates } = getActivityWindow();

  const [{ data: accounts }, { data: contests }, { data: activity }] =
    await Promise.all([
      supabase
        .from("platform_accounts")
        .select("platform, handle, verified, last_synced_at")
        .eq("profile_id", id)
        .order("platform"),
      supabase
        .from("contest_participation")
        .select("platform, contest_name, contest_date, rank, rating_change")
        .eq("profile_id", id)
        .order("contest_date", { ascending: false })
        .limit(5),
      supabase
        .from("activity_daily")
        .select("activity_date, solved, commits")
        .eq("profile_id", id)
        .gte("activity_date", since),
    ]);

  if (id !== user.id) {
    try {
      await createAdminClient().from("audit_logs").insert({
        actor_id: user.id,
        action: "view_contact",
        target_id: id,
      });
    } catch {
      // Logging must never break the page.
    }
  }

  const byDay = new Map<string, { solved: number; commits: number }>();
  for (const a of activity ?? []) {
    const d = byDay.get(a.activity_date) ?? { solved: 0, commits: 0 };
    d.solved += a.solved;
    d.commits += a.commits;
    byDay.set(a.activity_date, d);
  }
  const days = dayDates.map((date) => {
    const d = byDay.get(date) ?? { solved: 0, commits: 0 };
    return { date, ...d, total: d.solved + d.commits };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  const totalSolved = days.reduce((s, d) => s + d.solved, 0);
  const totalCommits = days.reduce((s, d) => s + d.commits, 0);

  const canManage =
    me.role === "super_admin" &&
    member.id !== user.id &&
    member.role !== "super_admin";

  return (
    <>
      <AppNav role={me.role} name={me.full_name} />
      <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
        <Link href="/members" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Back to members
        </Link>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{member.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  statusColors[member.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {member.status}
              </span>
              <span className="text-xs capitalize text-muted-foreground">
                {member.role.replace("_", " ")}
              </span>
            </div>
          </div>
        </header>

        {/* Info grid */}
        <section className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <Info label="Email" value={member.email} />
          <Info label="Contact" value={member.contact || "—"} />
          <Info label="Student ID" value={member.student_id} mono />
          <Info label="Batch" value={member.batch || "—"} />
          <Info label="Last login" value={formatDateTime(lastSignIn)} />
          <Info label="Joined" value={formatDate(member.created_at)} />
          <Info
            label="Consent given"
            value={member.consent_at ? formatDate(member.consent_at) : "No"}
          />
        </section>

        {/* Platform usernames */}
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Platform usernames</h2>
          </div>
          {accounts && accounts.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {accounts.map((a) => (
                <li
                  key={a.platform}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span>{platformIcons[a.platform] ?? "🔗"}</span>
                    <span className="font-medium">
                      {platformLabels[a.platform] ?? a.platform}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.handle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {a.verified ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Unverified
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      synced {formatDateTime(a.last_synced_at).replace("Never", "never")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No platform usernames added.
            </p>
          )}
        </section>

        {/* Activity chart */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="font-semibold">Last 14 days</h2>
            <p className="text-sm text-muted-foreground">
              {totalSolved} problems solved &middot; {totalCommits} GitHub contributions
            </p>
          </div>
          {totalSolved + totalCommits > 0 ? (
            <>
              <div className="flex h-24 items-end gap-1">
                {days.map((d) => (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="absolute bottom-0 w-full rounded-sm bg-primary/70 transition-all group-hover:bg-primary"
                      style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                      title={`${d.date}: ${d.solved} solved, ${d.commits} contributions`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{days[0].date.slice(5)}</span>
                <span>{days[6].date.slice(5)}</span>
                <span>{days[13].date.slice(5)}</span>
              </div>
            </>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-xs text-muted-foreground">
                No synced activity yet. Data appears after the next sync run.
              </p>
            </div>
          )}
        </section>

        {/* Recent contests */}
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Recent contests</h2>
          </div>
          {contests && contests.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {contests.map((c) => (
                <li
                  key={`${c.platform}-${c.contest_name}-${c.contest_date}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <span className="font-medium">{c.contest_name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({platformLabels[c.platform] ?? c.platform})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(c.contest_date)}
                    {c.rank != null && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5">
                        rank {c.rank}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No contest data yet.
            </p>
          )}
        </section>

        {/* Admin actions */}
        {canManage && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-1 font-semibold">Admin actions</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Every change is saved in the audit log.
            </p>
            <form action={changeMember} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={member.id} />
              {member.role === "member" ? (
                <button
                  type="submit"
                  name="action"
                  value="make_advisor"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  Make advisor
                </button>
              ) : (
                <button
                  type="submit"
                  name="action"
                  value="make_member"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  Make regular member
                </button>
              )}
              {member.status === "suspended" ? (
                <button
                  type="submit"
                  name="action"
                  value="reactivate"
                  className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                >
                  Reactivate account
                </button>
              ) : (
                <button
                  type="submit"
                  name="action"
                  value="suspend"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/20"
                >
                  Suspend account
                </button>
              )}
            </form>
          </section>
        )}
      </main>
    </>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={mono ? "font-mono text-sm mt-0.5" : "mt-0.5"}>{value}</p>
    </div>
  );
}
