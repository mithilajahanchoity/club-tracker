import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex items-center justify-center">
            <div className="rounded-xl border border-border/70 bg-white p-2 shadow-xs">
              <Image
                src="/images/club-logo.jpg"
                alt="NSTU ICE Programming Club"
                width={140}
                height={70}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sign in to ICE Programming Club Tracker
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notice =
    error === "confirm"
      ? "That confirmation link is invalid or expired. Try signing in, or sign up again."
      : undefined;
  return <LoginForm notice={notice} />;
}
