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

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
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

  // Member list with last login (runs through a checked database function).
  const { data: overview, error } = await supabase.rpc(
    "staff_member_overview"
  );
  const all = (overview ?? []) as Row[];

  // Username search: find members whose platform username matches.
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
    // login: most recent first, people who never logged in last
    return (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? "");
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const ids = pageRows.map((r) => r.id);

  // Handles and last contest, only for the members on this page.
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

  const inputClass =
    "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <>
      <AppNav role={me.role} name={me.full_name} />
      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "member" : "members"}
          </p>
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, student ID or username"
            className={`${inputClass} min-w-64 flex-1`}
          />
          <select name="batch" defaultValue={batch} className={inputClass}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <select name="sort" defaultValue={sort} className={inputClass}>
            <option value="login">Sort: last login</option>
            <option value="newest">Sort: newest</option>
            <option value="name">Sort: name</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Apply
          </button>
          <Link
            href="/members"
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Reset
          </Link>
        </form>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            Could not load members. Check that the database script ran
            successfully.
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Student ID</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Usernames</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2">Last contest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No members match these filters.
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2">{r.student_id}</td>
                  <td className="px-3 py-2">{r.batch || "None"}</td>
                  <td className="px-3 py-2 capitalize">
                    {r.status}
                    {r.role !== "member" && (
                      <span className="block text-xs text-muted-foreground">
                        {r.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(accountsByMember.get(r.id) ?? []).map((a) => (
                      <span key={a.platform} className="mr-2 inline-block">
                        <span className="text-muted-foreground">
                          {shortPlatform[a.platform] ?? a.platform}
                        </span>{" "}
                        {a.handle}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatDateTime(r.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatDate(lastContest.get(r.id))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav className="flex items-center justify-between text-sm">
            {current > 1 ? (
              <Link href={link(current - 1)} className="underline">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {current} of {pages}
            </span>
            {current < pages ? (
              <Link href={link(current + 1)} className="underline">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <p className="text-xs text-muted-foreground">
          Last login is the last sign-in to this site. Last contest comes from
          synced platform data and stays empty until syncing is set up.
        </p>
      </main>
    </>
  );
}
