"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

// Runs on the server only. The caller is re-checked EVERY time, because
// anyone can send a request to a server action, not just people who see the button.
export async function decideMember(formData: FormData) {
  const { user } = await requireSuperAdmin();

  const parsed = schema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return;

  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ status: parsed.data.decision })
    .eq("id", parsed.data.id)
    .eq("status", "pending");
  if (error) throw new Error("Could not update the member.");

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: `member_${parsed.data.decision}`,
    target_id: parsed.data.id,
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/dashboard");
}
