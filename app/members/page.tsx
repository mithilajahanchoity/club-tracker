import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { formatDate, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 25;

const querySchema = z.object({
  q: z.string().trim().max(50).catch(""),
  batch: z.string().trim().max(20).catch(""),
  status: z
    .enum(["all", "pending", "approved", "rejected", "suspended"])
    .catch("all"),
  sort: z.enum(["login", "newest", "name"]).catch("login"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

type SearchParams = Record<string, string | string[] | undefined>;

type Row = {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  batch: string;
  role: string;
  status: string;
  last_sign_in_at: string | null;
  created_at: string;
};

const shortPlatform: Record<string, string> = {
  codeforces: "CF",
  codechef: "CC",
  vjudge: "VJ",
  beecrowd: "BC",
  hackerrank: "HR",
  github: "GH",
};

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense>
      <MembersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile: me } = await requireStaff();
  const raw = await searchParams;
  const { q, batch, status, sort, page } = querySchema.parse({
    q: first(raw.q),
    batch: first(raw.batch),
    status: first(raw.status),
    sort: first(raw.sort),
    page: first(raw.page),
  });

  const supabase = await createClient();

  const { data: overview, error } = await supabase.rpc(
    "staff_member_overview"
  );
  const all = (overview ?? []) as Row[];

  let handleMatches = new Set<string>();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const { data } = await supabase
      .from("platform_accounts")
      .select("profile_id")
      .ilike("handle", pattern)
      .limit(1000);
    handleMatches = new Set((data ?? []).map((d) => d.profile_id as string));
  }

  const needle = q.toLowerCase();
  const batches = [...new Set(all.map((r) => r.batch).filter(Boolean))].sort();

  let rows = all.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (batch && r.batch !== batch) return false;
    if (needle) {
      const hit =
        r.full_name.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.student_id.toLowerCase().includes(needle) ||
        handleMatches.has(r.id);
      if (!hit) return false;
    }
    return true;
  });

  rows = [...rows].sort((a, b) => {
    if (sort === "name") return a.full_name.localeCompare(b.full_name);
    if (sort === "newest") return b.created_at.localeCompare(a.created_at);
    return (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? "");
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const ids = pageRows.map((r) => r.id);

  const accountsByMember = new Map<
    string,
    { platform: string; handle: string; verified: boolean }[]
  >();
  const lastContest = new Map<string, string>();

  if (ids.length > 0) {
    const { data: accounts } = await supabase
      .from("platform_accounts")
      .select("profile_id, platform, handle, verified")
      .in("profile_id", ids)
      .order("platform");
    for (const a of accounts ?? []) {
      const list = accountsByMember.get(a.profile_id) ?? [];
      list.push(a);
      accountsByMember.set(a.profile_id, list);
    }

    const { data: contests } = await supabase
      .from("contest_participation")
      .select("profile_id, contest_date")
      .in("profile_id", ids)
      .order("contest_date", { ascending: false })
      .limit(1000);
    for (const c of contests ?? []) {
      if (!lastContest.has(c.profile_id)) {
        lastContest.set(c.profile_id, c.contest_date);
      }
    }
  }

  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (batch) params.set("batch", batch);
    if (status !== "all") params.set("status", status);
    if (sort !== "login") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/members?${s}` : "/members";
  };

  const selectClass =
    "rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <>
      <AppNav role={me.role} name={me.full_name} />
      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Members</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {total} {total === 1 ? "member" : "members"}
              {status !== "all" && ` · filtered by ${status}`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <form method="get" className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, ID or username…"
            className={`${selectClass} min-w-64 flex-1`}
          />
          <select name="batch" defaultValue={batch} className={selectClass}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <select name="sort" defaultValue={sort} className={selectClass}>
            <option value="login">Sort: last login</option>
            <option value="newest">Sort: newest</option>
            <option value="name">Sort: name</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Apply
          </button>
          <Link
            href="/members"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
          >
            Reset
          </Link>
        </form>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load members. Check that the database script ran successfully.
          </p>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usernames</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Last contest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center"
                  >
                    <p className="text-2xl mb-2">🔍</p>
                    <p className="text-muted-foreground">No members match these filters.</p>
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/members/${r.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {r.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.student_id}</td>
                  <td className="px-4 py-3">{r.batch || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        statusColors[r.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.role !== "member" && (
                      <span className="ml-1 block text-xs text-muted-foreground capitalize">
                        {r.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {(accountsByMember.get(r.id) ?? []).map((a) => (
                        <span
                          key={a.platform}
                          title={a.platform}
                          className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground"
                        >
                          {shortPlatform[a.platform] ?? a.platform}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(r.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(lastContest.get(r.id))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <nav className="flex items-center justify-between text-sm">
            {current > 1 ? (
              <Link
                href={link(current - 1)}
                className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {current} of {pages}
            </span>
            {current < pages ? (
              <Link
                href={link(current + 1)}
                className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:bg-muted"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <p className="text-xs text-muted-foreground">
          Last login reflects the last sign-in to this site. Last contest comes from synced platform data.
        </p>
      </main>
    </>
  );
}
