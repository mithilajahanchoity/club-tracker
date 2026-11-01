import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { setVisibility } from "./actions";

const querySchema = z.object({
  period: z.enum(["7", "30", "all"]).catch("7"),
  sort: z.enum(["score", "consistent", "improved"]).catch("score"),
  batch: z.string().trim().max(20).catch(""),
});

type SearchParams = Record<string, string | string[] | undefined>;

type Row = {
  member_id: string;
  member_name: string;
  member_batch: string;
  score: number;
  prev_score: number;
  solved: number;
  contributions: number;
  contests: number;
  active_days: number;
};

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
      <LeaderboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LeaderboardContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, profile } = await requireApproved();
  const raw = await searchParams;
  const parsed = querySchema.parse({
    period: first(raw.period),
    sort: first(raw.sort),
    batch: first(raw.batch),
  });
  const { period, batch } = parsed;
  // "Most improved" compares with the period before, which "all time" lacks.
  const sort = period === "all" && parsed.sort === "improved" ? "score" : parsed.sort;

  const supabase = await createClient();

  const [{ data: board, error }, { data: settings }, { data: mine }] =
    await Promise.all([
      supabase.rpc("leaderboard", {
        p_days: period === "all" ? 3650 : Number(period),
      }),
      supabase.from("score_settings").select("*").maybeSingle(),
      supabase
        .from("profiles")
        .select("show_on_leaderboard")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const all = (board ?? []) as Row[];
  const batches = [...new Set(all.map((r) => r.member_batch).filter(Boolean))].sort();

  const metric = (r: Row) =>
    sort === "consistent"
      ? r.active_days
      : sort === "improved"
        ? r.score - r.prev_score
        : r.score;

  const rows = all
    .filter((r) => !batch || r.member_batch === batch)
    .sort(
      (a, b) =>
        metric(b) - metric(a) ||
        b.score - a.score ||
        a.member_name.localeCompare(b.member_name)
    )
    .slice(0, 200);

  // Tied members share a rank.
  const rankOf = (i: number) => rows.findIndex((r) => metric(r) === metric(rows[i])) + 1;

  const hidden = mine ? mine.show_on_leaderboard === false : false;

  const periodLabel =
    period === "7" ? "last 7 days" : period === "30" ? "last 30 days" : "all time";

  const tab = (label: string, key: string, value: string) => {
    const params = new URLSearchParams();
    const next = { period, sort, batch, [key]: value } as Record<string, string>;
    if (next.period !== "7") params.set("period", next.period);
    if (next.sort !== "score") params.set("sort", next.sort);
    if (next.batch) params.set("batch", next.batch);
    const current =
      (key === "period" && period === value) ||
      (key === "sort" && sort === value);
    return (
      <Link
        key={`${key}-${value}`}
        href={`/leaderboard${params.toString() ? `?${params}` : ""}`}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          current
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Showing {periodLabel}. Scores come from synced Codeforces and
            GitHub activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tab("Last 7 days", "period", "7")}
          {tab("Last 30 days", "period", "30")}
          {tab("All time", "period", "all")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab("Top score", "sort", "score")}
          {tab("Most consistent", "sort", "consistent")}
          {period !== "all" && tab("Most improved", "sort", "improved")}
          <form method="get" className="ml-auto flex gap-2">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="sort" value={sort} />
            <select
              name="batch"
              defaultValue={batch}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  Batch {b}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Filter
            </button>
          </form>
        </div>

        {hidden && (
          <form
            action={setVisibility}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3 text-sm"
          >
            <span>You are hidden from the leaderboard.</span>
            <input type="hidden" name="visibility" value="show" />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5"
            >
              Show me
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            Could not load the leaderboard. Check that the leaderboard database
            script (002) has been run.
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2 text-right">Score</th>
                {sort === "improved" && (
                  <th className="px-3 py-2 text-right">Change</th>
                )}
                <th className="px-3 py-2 text-right">Solved</th>
                <th className="px-3 py-2 text-right">GitHub</th>
                <th className="px-3 py-2 text-right">Contests</th>
                <th className="px-3 py-2 text-right">Active days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No scores yet. They appear after the first sync.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={r.member_id}
                  className={r.member_id === user.id ? "bg-muted" : undefined}
                >
                  <td className="px-3 py-2 font-medium">{rankOf(i)}</td>
                  <td className="px-3 py-2">
                    {r.member_name}
                    {r.member_batch && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Batch {r.member_batch}
                      </span>
                    )}
                    {r.member_id === user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{r.score}</td>
                  {sort === "improved" && (
                    <td className="px-3 py-2 text-right">
                      {r.score - r.prev_score > 0 ? "+" : ""}
                      {r.score - r.prev_score}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">{r.solved}</td>
                  <td className="px-3 py-2 text-right">{r.contributions}</td>
                  <td className="px-3 py-2 text-right">{r.contests}</td>
                  <td className="px-3 py-2 text-right">{r.active_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {settings && (
          <section className="rounded-lg border border-border p-4 text-sm">
            <h2 className="mb-2 font-semibold">How scoring works</h2>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>{settings.points_per_solved} points for each problem solved</li>
              <li>
                {settings.points_per_contest} points for each rated contest
              </li>
              <li>
                {settings.points_per_contribution} points per GitHub
                contribution, counting at most {settings.contribution_daily_cap}{" "}
                a day
              </li>
              <li>
                {settings.points_per_active_day} points for each day with any
                activity
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Only Codeforces and GitHub are counted so far. Days follow
              Bangladesh time. Only your name, batch and these numbers are
              shown here.
            </p>
          </section>
        )}

        {!hidden && (
          <form action={setVisibility} className="text-xs text-muted-foreground">
            <input type="hidden" name="visibility" value="hide" />
            <button type="submit" className="underline">
              Hide me from the leaderboard
            </button>
          </form>
        )}
      </main>
    </>
  );
}
