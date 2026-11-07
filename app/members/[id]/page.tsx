import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppNav } from "@/components/app-nav";
import { formatDate, formatDateTime } from "@/lib/format";
import { MemberPlatformStats } from "@/components/member-platform-stats";
import { getBeecrowdPublicDetails } from "@/lib/beecrowd";
import { getCodeforcesPublicDetails } from "@/lib/codeforces";
import { getVJudgePublicDetails } from "@/lib/vjudge";
import { getGitHubPublicDetails } from "@/lib/github";
import { getCodeChefPublicDetails } from "@/lib/codechef";
import { getLeetCodePublicDetails } from "@/lib/leetcode";
import { SyncPlatformButton } from "@/components/sync-platform-button";
import { PlatformIcon } from "@/components/platform-icon";
import { changeMember } from "./actions";

const platformLabels: Record<string, string> = {
  codeforces: "Codeforces",
  codechef: "CodeChef",
  vjudge: "VJudge",
  beecrowd: "Beecrowd",
  hackerrank: "HackerRank",
  github: "GitHub",
  leetcode: "LeetCode",
};

const platformIcons: Record<string, string> = {
  codeforces: "⚡",
  codechef: "🍳",
  vjudge: "⚖",
  beecrowd: "🐝",
  hackerrank: "💻",
  github: "🐙",
  leetcode: "🔶",
};

const platformUrls: Record<string, (handle: string) => string> = {
  codeforces: (h) => `https://codeforces.com/profile/${h}`,
  hackerrank: (h) => `https://www.hackerrank.com/profile/${h}`,
  beecrowd: (h) => `https://judge.beecrowd.com/en/profile/${h}`,
  github: (h) => `https://github.com/${h}`,
  codechef: (h) => `https://www.codechef.com/users/${h}`,
  vjudge: (h) => `https://vjudge.net/user/${h}`,
  leetcode: (h) => `https://leetcode.com/u/${h}`,
};

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  return (
    <Suspense>
      <MemberContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MemberContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const { user, profile: me } = await requireStaff();
  const { id } = await params;
  const { platform: initialPlatform } = await searchParams;
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
        .limit(100),
      supabase
        .from("activity_daily")
        .select("platform, activity_date, solved, commits, rating")
        .eq("profile_id", id)
        .order("activity_date", { ascending: true }),
    ]);

  // Fetch Beecrowd public details if member has a Beecrowd handle
  const beecrowdAccount = (accounts ?? []).find((a) => a.platform === "beecrowd");
  let beecrowdDetails = null;
  if (beecrowdAccount?.handle) {
    const beecrowdSolved = (activity ?? [])
      .filter((a) => a.platform === "beecrowd")
      .reduce((s, a) => s + (a.solved || 0), 0);
    const beecrowdRating =
      (activity ?? []).find((a) => a.platform === "beecrowd" && a.rating != null)?.rating ?? null;
    beecrowdDetails = await getBeecrowdPublicDetails(
      beecrowdAccount.handle,
      beecrowdSolved,
      beecrowdRating
    );
  }

  // Fetch Codeforces public details if member has a Codeforces handle
  const codeforcesAccount = (accounts ?? []).find((a) => a.platform === "codeforces");
  let codeforcesDetails = null;
  if (codeforcesAccount?.handle) {
    const cfActivity = (activity ?? []).filter((a) => a.platform === "codeforces");
    const cfContests = (contests ?? []).filter((c) => c.platform === "codeforces");
    codeforcesDetails = await getCodeforcesPublicDetails(
      codeforcesAccount.handle,
      cfActivity,
      cfContests
    );
  }

  // Fetch VJudge public details if member has a VJudge handle
  const vjudgeAccount = (accounts ?? []).find((a) => a.platform === "vjudge");
  let vjudgeDetails = null;
  if (vjudgeAccount?.handle) {
    const vjudgeSolved = (activity ?? [])
      .filter((a) => a.platform === "vjudge")
      .reduce((s, a) => s + (a.solved || 0), 0);
    const vjudgeRating =
      (activity ?? []).find((a) => a.platform === "vjudge" && a.rating != null)?.rating ?? null;
    vjudgeDetails = await getVJudgePublicDetails(
      vjudgeAccount.handle,
      member.email,
      vjudgeSolved,
      vjudgeRating
    );
  }

  // Fetch GitHub public details if member has a GitHub handle
  const githubAccount = (accounts ?? []).find((a) => a.platform === "github");
  let githubDetails = null;
  if (githubAccount?.handle) {
    const ghActivity = (activity ?? [])
      .filter((a) => a.platform === "github")
      .map((a) => ({ activity_date: a.activity_date, commits: a.commits || 0 }));
    githubDetails = await getGitHubPublicDetails(
      githubAccount.handle,
      ghActivity
    );
  }

  // Fetch CodeChef public details if member has a CodeChef handle
  const codechefAccount = (accounts ?? []).find((a) => a.platform === "codechef");
  let codechefDetails = null;
  if (codechefAccount?.handle) {
    const ccActivity = (activity ?? []).filter((a) => a.platform === "codechef");
    const ccContests = (contests ?? []).filter((c) => c.platform === "codechef");
    codechefDetails = await getCodeChefPublicDetails(
      codechefAccount.handle,
      ccActivity,
      ccContests
    );
  }

  // Fetch LeetCode public details if member has a LeetCode handle
  const leetcodeAccount = (accounts ?? []).find((a) => a.platform === "leetcode");
  let leetcodeDetails = null;
  if (leetcodeAccount?.handle) {
    const lcActivity = (activity ?? []).filter((a) => a.platform === "leetcode");
    const lcContests = (contests ?? []).filter((c) => c.platform === "leetcode");
    leetcodeDetails = await getLeetCodePublicDetails(
      leetcodeAccount.handle,
      lcActivity,
      lcContests
    );
  }

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
                    <PlatformIcon
                      platform={a.platform}
                      className="h-4 w-4 shrink-0"
                      fallback={<span>{platformIcons[a.platform] ?? "🔗"}</span>}
                    />
                    <span className="font-medium">
                      {platformLabels[a.platform] ?? a.platform}
                    </span>
                    {platformUrls[a.platform] ? (
                      <a
                        href={platformUrls[a.platform](a.handle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                        title={`Open ${platformLabels[a.platform] ?? a.platform} profile`}
                      >
                        <span>{a.handle}</span>
                        <span className="text-[10px] opacity-70">↗</span>
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.handle}
                      </span>
                    )}
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
                    <SyncPlatformButton
                      profileId={member.id}
                      platform={a.platform}
                      platformName={platformLabels[a.platform] ?? a.platform}
                    />
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

        {/* Comprehensive Platform Stats & 52-Week Activity Heatmap */}
        <MemberPlatformStats
          accounts={accounts ?? []}
          activity={activity ?? []}
          contests={contests ?? []}
          initialPlatform={initialPlatform}
          beecrowdDetails={beecrowdDetails}
          codeforcesDetails={codeforcesDetails}
          vjudgeDetails={vjudgeDetails}
          githubDetails={githubDetails}
          codechefDetails={codechefDetails}
          leetcodeDetails={leetcodeDetails}
          profileId={member.id}
        />

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
