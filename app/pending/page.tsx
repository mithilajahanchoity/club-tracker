import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default function PendingPage() {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
      <PendingContent />
    </Suspense>
  );
}

async function PendingContent() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.status === "approved") redirect("/dashboard");

  const messages: Record<string, { title: string; body: string }> = {
    pending: {
      title: "Waiting for approval",
      body: "Your account is created. A club admin will review it soon. You can sign in again later to check.",
    },
    rejected: {
      title: "Registration not approved",
      body: "Your registration was not approved. Please contact a club admin if you think this is a mistake.",
    },
    suspended: {
      title: "Account suspended",
      body: "Your account is suspended. Please contact a club admin.",
    },
  };
  const msg = messages[current.profile.status] ?? messages.pending;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{msg.title}</h1>
      <p className="text-sm text-muted-foreground">{msg.body}</p>
      <p className="text-xs text-muted-foreground">
        Signed in as {current.profile.email}
      </p>
      <SignOutButton />
    </main>
  );
}
