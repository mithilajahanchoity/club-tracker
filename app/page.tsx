import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlatformIcon } from "@/components/platform-icon";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      }
    >
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

  const platforms = [
    { key: "codeforces", name: "Codeforces" },
    { key: "beecrowd", name: "Beecrowd" },
    { key: "vjudge", name: "VJudge" },
    { key: "github", name: "GitHub" },
    { key: "hackerrank", name: "HackerRank" },
    { key: "codechef", name: "CodeChef" },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-background via-background to-muted/30 p-6 text-center">
      <div className="space-y-4">
        {/* Official Club Logo */}
        <div className="mx-auto flex items-center justify-center">
          <div className="rounded-2xl border border-border/70 bg-white p-3 shadow-md dark:border-zinc-800">
            <Image
              src="/images/club-logo.jpg"
              alt="NSTU ICE Programming Club Logo"
              width={260}
              height={140}
              priority
              className="h-24 w-auto object-contain md:h-28"
            />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            ICE Programming Club Tracker
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Noakhali Science and Technology University
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Track members programming activity, contests, and engagement for club members.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Join Club / Register
        </Link>
      </div>

      {/* Supported Platforms Banner with Authentic SVG Logos */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-xs backdrop-blur-xs max-w-xl w-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Tracked Competitive Programming Platforms
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {platforms.map((p) => (
            <div
              key={p.key}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-background/80 p-2.5 transition-colors hover:border-primary/50"
            >
              <PlatformIcon platform={p.key} className="h-6 w-6" />
              <span className="text-[11px] font-medium text-foreground">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
