"use server";

import { revalidatePath } from "next/cache";
import { requireApproved } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileUpdateSchema, platformAccountsSchema } from "@/lib/validation";

export type ActionState = {
  success?: boolean;
  error?: string;
};

export async function updateProfileInfo(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireApproved();

  const raw = {
    full_name: formData.get("full_name"),
    batch: formData.get("batch"),
    contact: formData.get("contact"),
  };

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid input";
    return { error: firstError };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      batch: parsed.data.batch,
      contact: parsed.data.contact,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update profile: " + error.message };
  }

  try {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "member_profile_updated",
      target_id: user.id,
      details: parsed.data,
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/members");

  return { success: true };
}

export async function updatePlatformAccounts(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireApproved();

  const raw = {
    codeforces: formData.get("codeforces") || "",
    beecrowd: formData.get("beecrowd") || "",
    hackerrank: formData.get("hackerrank") || "",
    github: formData.get("github") || "",
    codechef: formData.get("codechef") || "",
    vjudge: formData.get("vjudge") || "",
  };

  const parsed = platformAccountsSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid handle format";
    return { error: firstError };
  }

  const admin = createAdminClient();

  // Fetch current accounts
  const { data: existingAccounts, error: fetchErr } = await admin
    .from("platform_accounts")
    .select("platform, handle, verified")
    .eq("profile_id", user.id);

  if (fetchErr) {
    return { error: "Failed to check existing accounts: " + fetchErr.message };
  }

  const existingMap = new Map((existingAccounts || []).map((a) => [a.platform, a]));
  const platforms = [
    "codeforces",
    "beecrowd",
    "hackerrank",
    "github",
    "codechef",
    "vjudge",
  ] as const;

  for (const p of platforms) {
    const newHandle = parsed.data[p]?.trim() || "";
    const existing = existingMap.get(p);

    if (!newHandle) {
      // Disconnect/remove if empty
      if (existing) {
        await admin
          .from("platform_accounts")
          .delete()
          .eq("profile_id", user.id)
          .eq("platform", p);
      }
    } else {
      if (existing) {
        // If handle changed, update handle and reset verified status
        if (existing.handle !== newHandle) {
          await admin
            .from("platform_accounts")
            .update({
              handle: newHandle,
              verified: false,
              last_synced_at: null,
            })
            .eq("profile_id", user.id)
            .eq("platform", p);
        }
      } else {
        // Insert new account
        await admin.from("platform_accounts").insert({
          profile_id: user.id,
          platform: p,
          handle: newHandle,
          verified: false,
        });
      }
    }
  }

  try {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "member_platforms_updated",
      target_id: user.id,
      details: parsed.data,
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/members");

  return { success: true };
}

export async function updatePassword(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireApproved();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
  });

  if (error) {
    return { error: "Failed to update password: " + error.message };
  }

  try {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "member_password_updated",
      target_id: user.id,
    });
  } catch {
    // Non-blocking
  }

  return { success: true };
}

