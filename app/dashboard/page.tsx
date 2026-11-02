import { Suspense } from "react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { AdvisorDashboard } from "@/components/dashboard/advisor-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

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

async function DashboardContent() {
  const { user, profile } = await requireApproved();
  const supabase = await createClient();

  // All approved roles can call leaderboard RPC to get current 7-day stats.
  // Advisors and super admins are automatically excluded from leaderboard rankings.
  const [{ data: board }, { data: staffProfiles }] = await Promise.all([
    supabase.rpc("leaderboard", { p_days: 7 }),
    supabase.from("profiles").select("id").in("role", ["advisor", "super_admin"]),
  ]);
  const staffIds = new Set((staffProfiles ?? []).map((s) => s.id));
  const leaderboardRows = ((board ?? []) as Array<{
    member_id: string;
    member_name: string;
    member_batch: string;
    score: number;
    solved: number;
    contributions: number;
    contests: number;
    active_days: number;
  }>).filter((r) => !staffIds.has(r.member_id));

  // 1. Super Admin: Operations & Management Command Center
  if (profile.role === "super_admin") {
    const [
      { data: pendingMembers },
      { data: allProfiles },
      { data: scoreSettings },
      { data: recentAuditLogs },
      { data: platformAccounts },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, student_id, batch, role, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, email, student_id, batch, role, status, created_at"),
      supabase.from("score_settings").select("*").maybeSingle(),
      supabase
        .from("audit_logs")
        .select("id, action, target_id, details, created_at, actor_id")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("platform_accounts")
        .select("platform, verified, last_synced_at"),
    ]);

    return (
      <>
        <AppNav role={profile.role} name={profile.full_name} />
        <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <SuperAdminDashboard
            profile={profile}
            pendingMembers={pendingMembers ?? []}
            allProfiles={allProfiles ?? []}
            leaderboardRows={leaderboardRows}
            scoreSettings={scoreSettings}
            recentAuditLogs={recentAuditLogs ?? []}
            platformAccounts={platformAccounts ?? []}
          />
        </main>
      </>
    );
  }

  // 2. Advisor: Read-Only Academic & Mentorship Oversight Hub
  if (profile.role === "advisor") {
    const [{ data: allProfiles }, { data: platformAccounts }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, student_id, batch, role, status, created_at"),
      supabase.from("platform_accounts").select("platform, verified"),
    ]);

    return (
      <>
        <AppNav role={profile.role} name={profile.full_name} />
        <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <AdvisorDashboard
            profile={profile}
            allProfiles={allProfiles ?? []}
            leaderboardRows={leaderboardRows}
            platformAccounts={platformAccounts ?? []}
          />
        </main>
      </>
    );
  }

  // 3. Member: Personal Competitive Programming Hub
  const { since, dayDates } = getActivityWindow();
  const [{ data: accounts }, { data: activityRows }] = await Promise.all([
    supabase
      .from("platform_accounts")
      .select("platform, handle, verified, last_synced_at")
      .eq("profile_id", user.id)
      .order("platform"),
    supabase
      .from("activity_daily")
      .select("activity_date, solved, commits")
      .eq("profile_id", user.id)
      .gte("activity_date", since),
  ]);

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <MemberDashboard
          profile={profile}
          accounts={accounts ?? []}
          leaderboardRows={leaderboardRows}
          activityRows={activityRows ?? []}
          dayDates={dayDates}
        />
      </main>
    </>
  );
}
