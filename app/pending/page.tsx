import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default function PendingPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></main>}>
      <PendingContent />
    </Suspense>
  );
}

async function PendingContent() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.status === "approved") redirect("/dashboard");

  const messages: Record<string, { icon: string; title: string; body: string; color: string }> = {
    pending: {
      icon: "⏳",
      title: "Waiting for approval",
      body: "Your account has been created successfully. A club admin will review and approve it shortly. Check back soon or wait for a confirmation email.",
      color: "text-amber-600 dark:text-amber-400",
    },
    rejected: {
      icon: "✕",
      title: "Registration not approved",
      body: "Your registration was not approved at this time. Please contact a club admin if you believe this is a mistake.",
      color: "text-destructive",
    },
    suspended: {
      icon: "⊘",
      title: "Account suspended",
      body: "Your account has been suspended. Please contact a club admin for more information.",
      color: "text-destructive",
    },
  };
  const msg = messages[current.profile.status] ?? messages.pending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-background to-muted/30 p-6 text-center">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className={`text-5xl ${msg.color}`}>{msg.icon}</div>
        <h1 className="text-xl font-semibold">{msg.title}</h1>
        <p className="text-sm text-muted-foreground">{msg.body}</p>
        <p className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium">{current.profile.email}</span>
        </p>
        <div className="pt-2">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
