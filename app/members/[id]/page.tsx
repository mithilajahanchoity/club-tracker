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

export default function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
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

  // Last login lives in the auth system; read it through the checked function.
  const { data: overview } = await supabase.rpc("staff_member_overview");
  const lastSignIn =
    ((overview ?? []) as { id: string; last_sign_in_at: string | null }[]).find(
      (r) => r.id === id
    )?.last_sign_in_at ?? null;

  const since = new Date(Date.now() - 13 * 86400000)
    .toISOString()
    .slice(0, 10);

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

  // Viewing someone's phone number is recorded in the audit log.
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

  // Last 14 days, newest last.
  const byDay = new Map<string, { solved: number; commits: number }>();
  for (const a of activity ?? []) {
    const d = byDay.get(a.activity_date) ?? { solved: 0, commits: 0 };
    d.solved += a.solved;
    d.commits += a.commits;
    byDay.set(a.activity_date, d);
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.now() - (13 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
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
      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <Link href="/members" className="text-sm underline">
          Back to members
        </Link>

        <header>
          <h1 className="text-2xl font-bold">{member.full_name}</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {member.status} · {member.role.replace("_", " ")}
          </p>
        </header>

        <section className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          <Info label="Email" value={member.email} />
          <Info label="Contact" value={member.contact || "None"} />
          <Info label="Student ID" value={member.student_id} />
          <Info label="Batch" value={member.batch || "None"} />
          <Info label="Last login" value={formatDateTime(lastSignIn)} />
          <Info label="Joined" value={formatDate(member.created_at)} />
          <Info
            label="Consent given"
            value={member.consent_at ? formatDate(member.consent_at) : "No"}
          />
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-semibold">Platform usernames</h2>
          {accounts && accounts.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {accounts.map((a) => (
                <li
                  key={a.platform}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-medium">
                      {platformLabels[a.platform] ?? a.platform}
                    </span>
                    : {a.handle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.verified ? "Verified" : "Unverified"} · last synced{" "}
                    {formatDateTime(a.last_synced_at).replace("Never", "never")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None added.</p>
          )}
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-1 font-semibold">Last 14 days</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {totalSolved} solved · {totalCommits} commits
          </p>
          <div className="flex h-24 items-end gap-1">
            {days.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.solved} solved, ${d.commits} commits`}
                className="flex-1 rounded-sm bg-primary/70"
                style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
              />
            ))}
          </div>
          {totalSolved + totalCommits === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              No synced activity yet. This fills in after platform syncing is
              set up.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-semibold">Recent contests</h2>
          {contests && contests.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {contests.map((c) => (
                <li
                  key={`${c.platform}-${c.contest_name}-${c.contest_date}`}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span>
                    {c.contest_name}{" "}
                    <span className="text-muted-foreground">
                      ({platformLabels[c.platform] ?? c.platform})
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(c.contest_date)}
                    {c.rank != null && ` · rank ${c.rank}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No contest data yet.
            </p>
          )}
        </section>

        {canManage && (
          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-3 font-semibold">Admin actions</h2>
            <form action={changeMember} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={member.id} />
              {member.role === "member" ? (
                <button
                  type="submit"
                  name="action"
                  value="make_advisor"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Make advisor
                </button>
              ) : (
                <button
                  type="submit"
                  name="action"
                  value="make_member"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Make regular member
                </button>
              )}
              {member.status === "suspended" ? (
                <button
                  type="submit"
                  name="action"
                  value="reactivate"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Reactivate account
                </button>
              ) : (
                <button
                  type="submit"
                  name="action"
                  value="suspend"
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive"
                >
                  Suspend account
                </button>
              )}
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Every change is saved in the audit log.
            </p>
          </section>
        )}
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}
