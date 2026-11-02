"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSingleAccount, manualSetBeecrowdStats, type SyncResult } from "@/lib/sync";

export async function syncPlatformAccountAction(
  profileId: string,
  platform: string
): Promise<SyncResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== "approved") {
    return { success: false, message: "Unauthorized. Please log in.", error: "Unauthorized" };
  }

  const isSelf = current.profile.id === profileId;
  const isStaff = current.profile.role === "advisor" || current.profile.role === "super_admin";

  if (!isSelf && !isStaff) {
    return { success: false, message: "You do not have permission to sync this account.", error: "Forbidden" };
  }

  const res = await syncSingleAccount(profileId, platform);

  if (res.success && isStaff && !isSelf) {
    try {
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        actor_id: current.user.id,
        action: "manual_platform_sync",
        target_id: profileId,
        details: { platform, result: res.message },
      });
    } catch {
      // Non-blocking
    }
  }

  revalidatePath(`/members/${profileId}`);
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");

  return res;
}

export async function updateBeecrowdStatsAction(
  profileId: string,
  solved: number,
  rank?: number | null
): Promise<SyncResult> {
  const current = await getCurrentProfile();
  if (!current || current.profile.status !== "approved") {
    return { success: false, message: "Unauthorized. Please log in.", error: "Unauthorized" };
  }

  const isSelf = current.profile.id === profileId;
  const isStaff = current.profile.role === "advisor" || current.profile.role === "super_admin";

  if (!isSelf && !isStaff) {
    return { success: false, message: "You do not have permission to update this account.", error: "Forbidden" };
  }

  const res = await manualSetBeecrowdStats(profileId, solved, rank);

  if (res.success && isStaff && !isSelf) {
    try {
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        actor_id: current.user.id,
        action: "manual_beecrowd_update",
        target_id: profileId,
        details: { solved, rank, result: res.message },
      });
    } catch {
      // Non-blocking
    }
  }

  revalidatePath(`/members/${profileId}`);
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");

  return res;
}


