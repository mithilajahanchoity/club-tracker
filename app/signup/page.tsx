import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl text-primary-foreground">
            🏆
          </div>
          <h1 className="text-2xl font-bold">Join Club Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Create your account — a club admin will review and approve it.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
