import { Suspense } from "react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decideMember } from "./actions";

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
      <ApprovalsContent />
    </Suspense>
  );
}

async function ApprovalsContent() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, email, student_id, batch, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pending members</h1>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </header>

      {!pending || pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one is waiting for approval.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div className="text-sm">
                <p className="font-medium">{m.full_name}</p>
                <p className="text-muted-foreground">
                  {m.email} · ID {m.student_id} · Batch {m.batch}
                </p>
              </div>
              <form action={decideMember} className="flex gap-2">
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Reject
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
