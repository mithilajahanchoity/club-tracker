import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppNav({ role, name }: { role: string; name: string }) {
  const isStaff = role === "advisor" || role === "super_admin";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-90 transition-opacity"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-white p-0.5 overflow-hidden shadow-2xs">
              <Image
                src="/images/club-logo.jpg"
                alt="ICE Programming Club"
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="hidden sm:inline">ICE Club Tracker</span>
            <span className="sm:hidden">Tracker</span>
          </Link>
          <Link
            href="/leaderboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Leaderboard
          </Link>
          {isStaff && (
            <Link
              href="/members"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Members
            </Link>
          )}
          {role === "super_admin" && (
            <>
              <Link
                href="/admin/approvals"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Approvals
              </Link>
              <Link
                href="/admin/score"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Scoring
              </Link>
            </>
          )}
          <Link
            href="/profile"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Profile
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/profile"
            className="hidden sm:inline transition-colors hover:text-foreground"
            title="View & Edit Profile"
          >
            {name}
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
