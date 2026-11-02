import Image from "next/image";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6 py-10">
      <div className="w-full max-w-lg space-y-6">
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
          <h1 className="text-2xl font-bold tracking-tight">Join ICE Programming Club</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
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
