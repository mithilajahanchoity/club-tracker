import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 p-6 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Join the club</h1>
        <p className="text-sm text-muted-foreground">
          Create your account. A club admin approves new members.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
