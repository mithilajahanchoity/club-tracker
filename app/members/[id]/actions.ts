"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["make_advisor", "make_member", "suspend", "reactivate"]),
});

const changes = {
  make_advisor: { role: "advisor" },
  make_member: { role: "member" },
  suspend: { status: "suspended" },
  reactivate: { status: "approved" },
} as const;

// Super admin only, re-checked on every call. The UI cannot create another
// super admin or change your own account, which protects you from lockout.
export async function changeMember(formData: FormData) {
  const { user } = await requireSuperAdmin();

  const parsed = schema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
  });
  if (!parsed.success) return;
  const { id, action } = parsed.data;
  if (id === user.id) return;

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.role === "super_admin") return;

  const { error } = await admin
    .from("profiles")
    .update(changes[action])
    .eq("id", id);
  if (error) throw new Error("Could not update the member.");

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: `member_${action}`,
    target_id: id,
  });

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
}
