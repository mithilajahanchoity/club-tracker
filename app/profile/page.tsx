import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const { user } = await requireApproved();
  const supabase = await createClient();

  const [
    { data: profileData },
    { data: accountsData },
    { data: activityData },
    { data: contestsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, student_id, batch, contact, role, status, consent_at, created_at, updated_at, designation, department"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("platform_accounts")
      .select("platform, handle, verified, last_synced_at")
      .eq("profile_id", user.id)
      .order("platform"),
    supabase
      .from("activity_daily")
      .select("solved, commits")
      .eq("profile_id", user.id),
    supabase
      .from("contest_participation")
      .select("id")
      .eq("profile_id", user.id),
  ]);

  if (!profileData) notFound();

  const totalSolved = (activityData ?? []).reduce((acc, a) => acc + (a.solved || 0), 0);
  const totalCommits = (activityData ?? []).reduce((acc, a) => acc + (a.commits || 0), 0);
  const totalContests = (contestsData ?? []).length;

  return (
    <>
      <AppNav role={profileData.role} name={profileData.full_name} />
      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <ProfileEditor
          profile={profileData}
          accounts={accountsData ?? []}
          stats={{
            totalSolved,
            totalCommits,
            totalContests,
          }}
        />
      </main>
    </>
  );
}

