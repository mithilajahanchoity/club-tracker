import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { decideMember } from "./actions";
import { formatDate } from "@/lib/format";

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsContent />
    </Suspense>
  );
}

async function ApprovalsContent() {
  const { profile } = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, email, student_id, batch, contact, role, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Pending approvals</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {pending?.length ?? 0} application{(pending?.length ?? 0) !== 1 ? "s" : ""} waiting
            </p>
          </div>
        </div>

        {!pending || pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-medium">All caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No members or advisors are waiting for approval.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-base text-foreground">{m.full_name}</p>
                      {m.role === "advisor" ? (
                        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          🎓 Advisor
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          👤 Member
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{m.email}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-0.5">
                      {m.role === "advisor" ? (
                        <>
                          {m.batch && (
                            <span>
                              Department: <span className="font-medium text-foreground">{m.batch}</span>
                            </span>
                          )}
                          {m.contact && (
                            <span>
                              Contact: <span className="font-medium text-foreground">{m.contact}</span>
                            </span>
                          )}
                          <span>Applied: {formatDate(m.created_at)}</span>
                        </>
                      ) : (
                        <>
                          <span>
                            ID: <span className="font-mono">{m.student_id}</span>
                          </span>
                          <span>Batch: {m.batch || "—"}</span>
                          {m.contact && <span>Contact: {m.contact}</span>}
                          <span>Signed up: {formatDate(m.created_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <form action={decideMember} className="flex gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      name="decision"
                      value="approved"
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="rejected"
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
