"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Lets a member show or hide THEMSELVES. Uses their own session, so the
// database only allows them to change their own row and this one column.
export async function setVisibility(formData: FormData) {
  const { user } = await requireApproved();

  const parsed = z.enum(["show", "hide"]).safeParse(formData.get("visibility"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ show_on_leaderboard: parsed.data === "show" })
    .eq("id", user.id);
  if (error) throw new Error("Could not update your preference.");

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
}
