import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { updateScoreSettings } from "./actions";

export default function ScorePage() {
  return (
    <Suspense>
      <ScoreContent />
    </Suspense>
  );
}

const fields = [
  {
    name: "points_per_solved",
    label: "Points per problem solved",
    hint: "Awarded for each unique problem first accepted on Codeforces.",
  },
  {
    name: "points_per_contest",
    label: "Points per rated contest",
    hint: "Awarded for each rated Codeforces contest participated in.",
  },
  {
    name: "points_per_contribution",
    label: "Points per GitHub contribution",
    hint: "Commits, PRs, issues, and code reviews — capped per day.",
  },
  {
    name: "contribution_daily_cap",
    label: "Max GitHub contributions per day",
    hint: "Prevents inflated scores from bulk commit days.",
  },
  {
    name: "points_per_active_day",
    label: "Points per active day",
    hint: "Bonus for any day with at least one solved problem or contribution.",
  },
] as const;

async function ScoreContent() {
  const { profile } = await requireSuperAdmin();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("score_settings")
    .select("*")
    .maybeSingle();

  return (
    <>
      <AppNav role={profile.role} name={profile.full_name} />
      <main className="mx-auto max-w-lg space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Scoring weights</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            These weights determine the leaderboard score. Changes apply immediately and
            are visible to all members on the leaderboard page.
          </p>
        </div>

        {!settings ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Scoring settings not found. Check that the leaderboard database script (002)
            has been run.
          </div>
        ) : (
          <form action={updateScoreSettings} className="space-y-4">
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {fields.map((f) => (
                <div key={f.name} className="px-4 py-4 space-y-1.5">
                  <label htmlFor={f.name} className="text-sm font-medium">
                    {f.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{f.hint}</p>
                  <input
                    id={f.name}
                    name={f.name}
                    type="number"
                    min={0}
                    max={1000}
                    step={1}
                    required
                    defaultValue={settings[f.name]}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Save weights
            </button>
          </form>
        )}
      </main>
    </>
  );
}
