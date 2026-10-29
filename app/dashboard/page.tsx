import { Suspense } from "react";
import Link from "next/link";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

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
    .select("platform, handle, verified")
    .eq("profile_id", user.id)
    .order("platform");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hello, {profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            Student ID {profile.student_id} · Batch {profile.batch} ·{" "}
            <span className="capitalize">{profile.role.replace("_", " ")}</span>
          </p>
        </div>
        <SignOutButton />
      </header>

      {profile.role === "super_admin" && (
        <Link
          href="/admin/approvals"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Review pending members
        </Link>
      )}

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
                  {a.verified ? "Verified" : "Unverified"} · sync coming soon
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
  );
}
