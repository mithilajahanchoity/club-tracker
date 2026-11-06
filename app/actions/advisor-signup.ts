"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface AdvisorProfilePayload {
  designation: string;
  department: string;
  contact: string;
  fullName: string;
}

export async function registerAdvisorProfile(
  userId: string,
  payload: AdvisorProfilePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // 1. Update profiles table to ensure role is advisor and store department/contact
    try {
      const { error: fullUpdateErr } = await admin
        .from("profiles")
        .update({
          role: "advisor",
          designation: payload.designation,
          department: payload.department,
          contact: payload.contact,
          batch: payload.department,
        })
        .eq("id", userId);

      if (fullUpdateErr) {
        // Fallback if designation/department columns are not yet added in PostgreSQL
        await admin
          .from("profiles")
          .update({
            role: "advisor",
            contact: payload.contact,
            batch: payload.department,
          })
          .eq("id", userId);
      }
    } catch {
      await admin
        .from("profiles")
        .update({
          role: "advisor",
          contact: payload.contact,
          batch: payload.department,
        })
        .eq("id", userId);
    }

    // 2. Persist full metadata in auth.users
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          role: "advisor",
          designation: payload.designation,
          department: payload.department,
          contact: payload.contact,
          full_name: payload.fullName,
        },
      });
    } catch (metaErr) {
      console.warn("Could not update auth user_metadata:", metaErr);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to register advisor profile";
    console.error("registerAdvisorProfile error:", msg);
    return { success: false, error: msg };
  }
}
