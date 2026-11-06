"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { SyncPlatformButton } from "@/components/sync-platform-button";
import { PlatformIcon } from "@/components/platform-icon";
import {
  updateProfileInfo,
  updatePlatformAccounts,
  updatePassword,
  type ActionState,
} from "@/app/profile/actions";

export type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  batch: string;
  contact: string;
  role: "member" | "advisor" | "super_admin";
  status: "pending" | "approved" | "rejected" | "suspended";
  consent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformAccountData = {
  platform: string;
  handle: string;
  verified: boolean;
  last_synced_at: string | null;
};

export type StatsSummary = {
  totalSolved: number;
  totalCommits: number;
  totalContests: number;
};

interface ProfileEditorProps {
  profile: ProfileData;
  accounts: PlatformAccountData[];
  stats: StatsSummary;
}

const platformMeta: Record<
  string,
  { label: string; icon: string; placeholder: string; url: (h: string) => string; hint?: string }
> = {
  codeforces: {
    label: "Codeforces",
    icon: "⚡",
    placeholder: "e.g. tourist",
    url: (h) => `https://codeforces.com/profile/${h}`,
  },
  beecrowd: {
    label: "Beecrowd",
    icon: "🐝",
    placeholder: "e.g. 812223 or username",
    url: (h) => `https://judge.beecrowd.com/en/profile/${h}`,
    hint: "Use your numeric User ID from your Beecrowd profile URL (e.g. judge.beecrowd.com/en/profile/812223).",
  },
  hackerrank: {
    label: "HackerRank",
    icon: "💻",
    placeholder: "e.g. hackerrank_handle",
    url: (h) => `https://www.hackerrank.com/profile/${h}`,
  },
  github: {
    label: "GitHub",
    icon: "🐙",
    placeholder: "e.g. octocat",
    url: (h) => `https://github.com/${h}`,
  },
  codechef: {
    label: "CodeChef",
    icon: "🍳",
    placeholder: "e.g. chef_handle",
    url: (h) => `https://codechef.com/users/${h}`,
  },
  vjudge: {
    label: "VJudge",
    icon: "⚖",
    placeholder: "e.g. vjudge_handle",
    url: (h) => `https://vjudge.net/user/${h}`,
  },
};

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring focus:border-ring";

const readOnlyClass =
  "w-full rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground outline-none cursor-not-allowed";

export function ProfileEditor({ profile, accounts, stats }: ProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<"personal" | "platforms" | "security">("personal");

  // Personal Info Form State
  const [fullName, setFullName] = useState(profile.full_name);
  const [batch, setBatch] = useState(profile.batch || "");
  const [contact, setContact] = useState(profile.contact || "");
  const [personalState, setPersonalState] = useState<ActionState | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  // Platforms Form State
  const initialAccountsMap: Record<string, string> = {
    codeforces: "",
    beecrowd: "",
    hackerrank: "",
    github: "",
    codechef: "",
    vjudge: "",
  };
  for (const a of accounts) {
    if (a.platform in initialAccountsMap) {
      initialAccountsMap[a.platform] = a.handle;
    }
  }
  const [handles, setHandles] = useState<Record<string, string>>(initialAccountsMap);
  const [platformState, setPlatformState] = useState<ActionState | null>(null);
  const [platformLoading, setPlatformLoading] = useState(false);

  // Security Form State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityState, setSecurityState] = useState<ActionState | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Account map for sync status lookup
  const accountLookup = new Map(accounts.map((a) => [a.platform, a]));

  // Compute initials
  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CP";

  async function handlePersonalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPersonalLoading(true);
    setPersonalState(null);
    try {
      const formData = new FormData();
      formData.set("full_name", fullName);
      formData.set("batch", batch);
      formData.set("contact", contact);
      const res = await updateProfileInfo(null, formData);
      setPersonalState(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setPersonalState({ error: message });
    } finally {
      setPersonalLoading(false);
    }
  }

  async function handlePlatformsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPlatformLoading(true);
    setPlatformState(null);
    try {
      const formData = new FormData();
      for (const [p, h] of Object.entries(handles)) {
        formData.set(p, h);
      }
      const res = await updatePlatformAccounts(null, formData);
      setPlatformState(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setPlatformState({ error: message });
    } finally {
      setPlatformLoading(false);
    }
  }

  async function handleSecuritySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSecurityLoading(true);
    setSecurityState(null);
    try {
      const formData = new FormData();
      formData.set("password", password);
      formData.set("confirm_password", confirmPassword);
      const res = await updatePassword(null, formData);
      setSecurityState(res);
      if (res.success) {
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setSecurityState({ error: message });
    } finally {
      setSecurityLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Member Overview Card */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Avatar Pill */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-xl font-bold text-white shadow-md">
              {initials}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {profile.full_name}
                </h1>
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-green-700 dark:bg-green-950 dark:text-green-300">
                  {profile.status}
                </span>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium capitalize text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  {profile.role.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {profile.role === "advisor" ? (
                  <>
                    {profile.batch && <span className="font-medium text-foreground">{profile.batch} &middot; </span>}
                    <span>{profile.email}</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono font-medium text-foreground">{profile.student_id}</span>
                    {profile.batch && <span> &middot; Batch {profile.batch}</span>}
                    <span> &middot; {profile.email}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>← Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Quick Activity Stats Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Solved Problems
            </p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{stats.totalSolved}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              GitHub Commits
            </p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{stats.totalCommits}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Contests
            </p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{stats.totalContests}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Connected Platforms
            </p>
            <p className="mt-0.5 text-xl font-bold text-foreground">
              {accounts.length} / 6
            </p>
          </div>
        </div>
      </section>

      {/* 2. Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "personal"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>👤</span>
          <span>Personal Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("platforms")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "platforms"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>🔗</span>
          <span>Platform Handles ({accounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "security"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>🔒</span>
          <span>Security & Password</span>
        </button>
      </div>

      {/* 3. Tab 1: Personal Info Editor */}
      {activeTab === "personal" && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
            <p className="text-xs text-muted-foreground">
              Update your personal details. Important institutional identifiers are protected.
            </p>
          </div>

          {/* Feedback messages */}
          {personalState?.success && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800 dark:border-green-900 dark:bg-green-950/60 dark:text-green-300">
              <span>✓</span>
              <span>Your profile information has been saved successfully.</span>
            </div>
          )}

          {personalState?.error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
              <span>⚠</span>
              <span>{personalState.error}</span>
            </div>
          )}

          <form onSubmit={handlePersonalSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="full_name" className="text-xs font-semibold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  Displayed on leaderboards and member directories.
                </p>
              </div>

              {/* Student ID (Read Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="student_id" className="text-xs font-semibold text-foreground">
                    Student ID
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">🔒 Locked</span>
                </div>
                <input
                  id="student_id"
                  type="text"
                  readOnly
                  disabled
                  value={profile.student_id}
                  className={readOnlyClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  Permanent academic record. Contact an admin if this needs correction.
                </p>
              </div>

              {/* Email Address (Read Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="email" className="text-xs font-semibold text-foreground">
                    Email Address
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">🔒 Locked</span>
                </div>
                <input
                  id="email"
                  type="email"
                  readOnly
                  disabled
                  value={profile.email}
                  className={readOnlyClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  Associated login credential.
                </p>
              </div>

              {/* Batch or Department */}
              <div className="space-y-1.5">
                <label htmlFor="batch" className="text-xs font-semibold text-foreground">
                  {profile.role === "advisor" ? "Department / Faculty" : "Batch / Intake"}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="batch"
                  type="text"
                  required
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder={profile.role === "advisor" ? "e.g. ICE" : "e.g. Batch 10 or 2022"}
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  {profile.role === "advisor"
                    ? "Academic department or faculty affiliation."
                    : "Used for batch filtering and statistics."}
                </p>
              </div>

              {/* Contact / Phone */}
              <div className="space-y-1.5">
                <label htmlFor="contact" className="text-xs font-semibold text-foreground">
                  Contact Number
                </label>
                <input
                  id="contact"
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. +8801700000000"
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  WhatsApp or phone for club announcements and notifications.
                </p>
              </div>

              {/* Account Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Membership Status</label>
                <div className="flex h-[42px] items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium capitalize text-foreground">{profile.status}</span>
                  <span className="text-muted-foreground">&middot;</span>
                  <span className="capitalize text-muted-foreground">
                    Role: {profile.role.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Read-only audit & registration details */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <span className="font-medium text-foreground">Registered:</span>{" "}
                  {formatDate(profile.created_at)}
                </div>
                <div>
                  <span className="font-medium text-foreground">Last Updated:</span>{" "}
                  {formatDate(profile.updated_at)}
                </div>
                <div>
                  <span className="font-medium text-foreground">Data Consent:</span>{" "}
                  {profile.consent_at ? "Given on " + formatDate(profile.consent_at) : "Pending"}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={personalLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {personalLoading ? "Saving..." : "Save Profile Details"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 4. Tab 2: Coding Platform Handles */}
      {activeTab === "platforms" && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-foreground">Connected Coding Platforms</h2>
            <p className="text-xs text-muted-foreground">
              Connect your online judge handles. Our automated crawler syncs your solved problems and contests.
            </p>
          </div>

          {/* Sync Information Notice */}
          <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
            <div className="flex items-start gap-2.5">
              <span className="text-base">ℹ️</span>
              <div className="space-y-1">
                <p className="font-semibold">How platform synchronization works:</p>
                <p className="leading-relaxed opacity-90">
                  When you add or update a handle, it will initially show as{" "}
                  <span className="font-medium underline">Unverified</span> until the automated background sync runs
                  and verifies your account. Empty handles are disconnected automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {platformState?.success && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800 dark:border-green-900 dark:bg-green-950/60 dark:text-green-300">
              <span>✓</span>
              <span>Platform handles saved successfully! New handles will be verified on the next sync.</span>
            </div>
          )}

          {platformState?.error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
              <span>⚠</span>
              <span>{platformState.error}</span>
            </div>
          )}

          <form onSubmit={handlePlatformsSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              {Object.entries(platformMeta).map(([platformKey, meta]) => {
                const currentAccount = accountLookup.get(platformKey);
                const handleVal = handles[platformKey] || "";

                return (
                  <div
                    key={platformKey}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card/80 p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <PlatformIcon
                            platform={platformKey}
                            className="h-5 w-5 shrink-0"
                            fallback={<span className="text-lg">{meta.icon}</span>}
                          />
                          <span>{meta.label}</span>
                        </div>

                        {/* Status badges */}
                        {currentAccount && (
                          <div className="flex items-center gap-1.5">
                            {currentAccount.verified ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                                Verified
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Pending Sync
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        value={handleVal}
                        onChange={(e) =>
                          setHandles((prev) => ({ ...prev, [platformKey]: e.target.value }))
                        }
                        placeholder={meta.placeholder}
                        className={inputClass}
                      />

                      {meta.hint && (
                        <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
                      )}
                    </div>

                    {/* Footer link & sync info */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {currentAccount?.last_synced_at
                            ? `Synced: ${formatDateTime(currentAccount.last_synced_at)}`
                            : "Not synced yet"}
                        </span>
                        {currentAccount && currentAccount.handle && (
                          <SyncPlatformButton
                            profileId={profile.id}
                            platform={platformKey}
                            platformName={meta.label}
                          />
                        )}
                      </div>

                      {handleVal.trim() && (
                        <a
                          href={meta.url(handleVal.trim())}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          Visit Profile ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={platformLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {platformLoading ? "Updating Handles..." : "Save Platform Handles"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 5. Tab 3: Security & Password */}
      {activeTab === "security" && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-foreground">Security & Password</h2>
            <p className="text-xs text-muted-foreground">
              Manage your password and ensure your account stays secure.
            </p>
          </div>

          {/* Feedback messages */}
          {securityState?.success && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800 dark:border-green-900 dark:bg-green-950/60 dark:text-green-300">
              <span>✓</span>
              <span>Your password has been changed successfully.</span>
            </div>
          )}

          {securityState?.error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
              <span>⚠</span>
              <span>{securityState.error}</span>
            </div>
          )}

          <form onSubmit={handleSecuritySubmit} className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new_password" className="text-xs font-semibold text-foreground">
                New Password <span className="text-destructive">*</span>
              </label>
              <input
                id="new_password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm_password" className="text-xs font-semibold text-foreground">
                Confirm New Password <span className="text-destructive">*</span>
              </label>
              <input
                id="confirm_password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={inputClass}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={securityLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {securityLoading ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

