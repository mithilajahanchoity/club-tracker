import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export function AppNav({ role, name }: { role: string; name: string }) {
  const isStaff = role === "advisor" || role === "super_admin";
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold">
            Club Tracker
          </Link>
          {isStaff && <Link href="/members">Members</Link>}
          {role === "super_admin" && (
            <Link href="/admin/approvals">Approvals</Link>
          )}
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{name}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
