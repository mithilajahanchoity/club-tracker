import { Suspense } from "react";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { updateScoreSettings } from "./actions";

export default function ScorePage() {
  return (
    <Suspense fallback={<main className="p-10">Loading...</main>}>
      <ScoreContent />
    </Suspense>
  );
}

const fields = [
  { name: "points_per_solved", label: "Points per problem solved" },
  { name: "points_per_contest", label: "Points per rated contest" },
  { name: "points_per_contribution", label: "Points per GitHub contribution" },
  { name: "contribution_daily_cap", label: "Max GitHub contributions counted per day" },
  { name: "points_per_active_day", label: "Points per active day" },
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
      <main className="mx-auto max-w-md space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Scoring</h1>
          <p className="text-sm text-muted-foreground">
            These weights decide the leaderboard score. Changes apply to all
            periods straight away and everyone can see them on the leaderboard.
          </p>
        </div>

        {!settings ? (
          <p role="alert" className="text-sm text-destructive">
            Scoring settings not found. Check that the leaderboard database
            script (002) has been run.
          </p>
        ) : (
          <form action={updateScoreSettings} className="space-y-4">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1">
                <label htmlFor={f.name} className="text-sm font-medium">
                  {f.label}
                </label>
                <input
                  id={f.name}
                  name={f.name}
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  required
                  defaultValue={settings[f.name]}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Save weights
            </button>
          </form>
        )}
      </main>
    </>
  );
}
