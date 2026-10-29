import { Suspense } from "react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { formatDateTime } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
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

async function DashboardContent() {
  const { user, profile } = await requireApproved();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("platform_accounts")
    .select("platform, handle, verified, last_synced_at")
    .eq("profile_id", user.id)
    .order("platform");

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Hello, {profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            Student ID {profile.student_id} · Batch {profile.batch} ·{" "}
            <span className="capitalize">{profile.role.replace("_", " ")}</span>
          </p>
        </div>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-semibold">My platform usernames</h2>
          {accounts && accounts.length > 0 ? (
            <ul className="divide-y divide-border">
              {accounts.map((a) => (
                <li
                  key={a.platform}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {platformLabels[a.platform] ?? a.platform}
                    </span>
                    : {a.handle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.verified ? "Verified" : "Unverified"} ·{" "}
                    {a.platform === "codeforces" || a.platform === "github"
                      ? a.last_synced_at
                        ? `synced ${formatDateTime(a.last_synced_at)}`
                        : "waiting for first sync"
                      : "sync coming soon"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have not added any usernames yet.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Your activity charts will appear here once platform syncing is set up.
        </section>
      </main>
    </>
  );
}
