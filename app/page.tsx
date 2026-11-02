import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></main>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/30 p-6 text-center">
      <div className="space-y-3">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground shadow-lg">
          🏆
        </div>
        <h1 className="text-4xl font-bold tracking-tight">ICE Programming Club Tracker</h1>
        <p className="max-w-sm text-muted-foreground">
          Track members programming activity, contests, and engagement for club members.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Create account
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-6 text-center text-sm text-muted-foreground">
        {[
          { icon: "⚡", label: "Codeforces sync" },
          { icon: "🐙", label: "GitHub activity" },
          { icon: "📊", label: "Live leaderboard" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1">
            <span className="text-xl">{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
