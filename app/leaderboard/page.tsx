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

const rankMedal = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

export default function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense>
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

  const rankOf = (i: number) => rows.findIndex((r) => metric(r) === metric(rows[i])) + 1;

  const hidden = mine ? mine.show_on_leaderboard === false : false;

  const periodLabel =
    period === "7" ? "last 7 days" : period === "30" ? "last 30 days" : "all time";

  const tabLink = (key: string, value: string) => {
    const params = new URLSearchParams();
    const next = { period, sort, batch, [key]: value } as Record<string, string>;
    if (next.period !== "7") params.set("period", next.period);
    if (next.sort !== "score") params.set("sort", next.sort);
    if (next.batch) params.set("batch", next.batch);
    return `/leaderboard${params.toString() ? `?${params}` : ""}`;
  };

  const renderTab = (label: string, key: string, value: string) => {
    const active =
      (key === "period" && period === value) ||
      (key === "sort" && sort === value);
    return (
      <Link
        key={`${key}-${value}`}
        href={tabLink(key, value)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "bg-primary text-primary-foreground"
            : "border border-border hover:bg-muted"
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
          <p className="mt-0.5 text-sm text-muted-foreground">
            Showing {periodLabel} · Scores from Codeforces and GitHub activity
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex flex-wrap gap-2">
          {renderTab("Last 7 days", "period", "7")}
          {renderTab("Last 30 days", "period", "30")}
          {renderTab("All time", "period", "all")}
        </div>

        {/* Sort tabs + batch filter */}
        <div className="flex flex-wrap items-center gap-2">
          {renderTab("Top score", "sort", "score")}
          {renderTab("Most consistent", "sort", "consistent")}
          {period !== "all" && renderTab("Most improved", "sort", "improved")}
          <form method="get" className="ml-auto flex gap-2">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="sort" value={sort} />
            <select
              name="batch"
              defaultValue={batch}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Hidden banner */}
        {hidden && (
          <form
            action={setVisibility}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <span>👁 You are hidden from the leaderboard.</span>
            <input type="hidden" name="visibility" value="show" />
            <button
              type="submit"
              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900"
            >
              Show me on the board
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load the leaderboard. Check that the leaderboard database script (002) has been run.
          </p>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3 text-right">Score</th>
                {sort === "improved" && (
                  <th className="px-4 py-3 text-right">Change</th>
                )}
                <th className="px-4 py-3 text-right">Solved</th>
                <th className="px-4 py-3 text-right">GitHub</th>
                <th className="px-4 py-3 text-right">Contests</th>
                <th className="px-4 py-3 text-right">Active days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center"
                  >
                    <p className="text-2xl mb-2">📊</p>
                    <p className="text-muted-foreground">No scores yet. They appear after the first sync.</p>
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const isMe = r.member_id === user.id;
                const rank = rankOf(i);
                const medal = rankMedal(rank);
                const improvement = r.score - r.prev_score;
                return (
                  <tr
                    key={r.member_id}
                    className={`transition-colors ${
                      isMe
                        ? "bg-primary/5 font-medium"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      {medal ? (
                        <span title={`Rank ${rank}`}>{medal}</span>
                      ) : (
                        <span className="text-muted-foreground">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.member_name}
                      {r.member_batch && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          Batch {r.member_batch}
                        </span>
                      )}
                      {isMe && (
                        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {r.score}
                    </td>
                    {sort === "improved" && (
                      <td className={`px-4 py-3 text-right tabular-nums ${improvement > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {improvement > 0 ? "+" : ""}{improvement}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.solved}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.contributions}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.contests}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.active_days}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Scoring explanation */}
        {settings && (
          <section className="rounded-xl border border-border bg-card p-4 text-sm">
            <h2 className="mb-2 font-semibold">How scoring works</h2>
            <ul className="space-y-1 text-muted-foreground">
              <li>⚡ {settings.points_per_solved} pts per problem solved</li>
              <li>🏅 {settings.points_per_contest} pts per rated contest</li>
              <li>🐙 {settings.points_per_contribution} pts per GitHub contribution (max {settings.contribution_daily_cap}/day)</li>
              <li>📅 {settings.points_per_active_day} pts per active day</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Only Codeforces and GitHub are counted so far. Days follow Bangladesh time.
            </p>
          </section>
        )}

        {/* Visibility toggle */}
        {!hidden && (
          <form action={setVisibility} className="text-xs text-muted-foreground">
            <input type="hidden" name="visibility" value="hide" />
            <button type="submit" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Hide me from the leaderboard
            </button>
          </form>
        )}
      </main>
    </>
  );
}
