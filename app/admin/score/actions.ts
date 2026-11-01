"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const points = z.coerce.number().int().min(0).max(1000);

const schema = z.object({
  points_per_solved: points,
  points_per_contest: points,
  points_per_contribution: points,
  contribution_daily_cap: points,
  points_per_active_day: points,
});

// Super admin only, re-checked on every call.
export async function updateScoreSettings(formData: FormData) {
  const { user } = await requireSuperAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("score_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error("Could not save the scoring settings.");

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "score_settings_updated",
    details: parsed.data,
  });

  revalidatePath("/admin/score");
  revalidatePath("/leaderboard");
}
