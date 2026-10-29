import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  batch: string;
  role: "member" | "advisor" | "super_admin";
  status: "pending" | "approved" | "rejected" | "suspended";
};

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, student_id, batch, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { user, profile: data as Profile };
}

// Use at the top of any page that needs a logged-in, approved member.
export async function requireApproved() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (current.profile.status !== "approved") redirect("/pending");
  return current;
}

// Use at the top of any page or action that only the super admin may use.
export async function requireSuperAdmin() {
  const current = await requireApproved();
  if (current.profile.role !== "super_admin") redirect("/dashboard");
  return current;
}

// Use at the top of any page that only advisors and the super admin may see.
export async function requireStaff() {
  const current = await requireApproved();
  if (current.profile.role !== "advisor" && current.profile.role !== "super_admin") {
    redirect("/dashboard");
  }
  return current;
}
