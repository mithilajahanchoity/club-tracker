"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { memberSignupSchema, advisorSignupSchema } from "@/lib/validation";
import { PlatformIcon } from "@/components/platform-icon";
import { registerAdvisorProfile } from "@/app/actions/advisor-signup";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";

type FormValues = {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  // Member fields
  student_id: string;
  batch: string;
  // Advisor fields
  designation: string;
  department: string;
  // Shared
  contact: string;
  // Platform usernames (Member only)
  cf_handle: string;
  codechef_handle: string;
  vjudge_handle: string;
  beecrowd_handle: string;
  hackerrank_handle: string;
  github_username: string;
};

const emptyValues: FormValues = {
  full_name: "",
  email: "",
  password: "",
  confirm_password: "",
  student_id: "",
  batch: "",
  designation: "",
  department: "",
  contact: "",
  cf_handle: "",
  codechef_handle: "",
  vjudge_handle: "",
  beecrowd_handle: "",
  hackerrank_handle: "",
  github_username: "",
};

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  error?: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id} className="flex items-center gap-1.5 text-sm font-medium">
        {props.icon}
        <span>{props.label}</span>
        {props.optional && (
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={`${inputClass} ${props.error ? "border-destructive focus:ring-destructive/30" : ""}`}
      />
      {props.hint && !props.error && (
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      )}
      {props.error && (
        <p role="alert" className="text-xs text-destructive">
          {props.error}
        </p>
      )}
    </div>
  );
}

export function SignupForm() {
  const [role, setRole] = useState<"member" | "advisor">("member");
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof FormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  function handleRoleChange(newRole: "member" | "advisor") {
    setRole(newRole);
    setErrors({});
    setFormError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const supabase = createClient();

    if (role === "member") {
      const parsed = memberSignupSchema.safeParse({
        role: "member",
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        confirm_password: values.confirm_password,
        student_id: values.student_id,
        batch: values.batch,
        contact: values.contact,
        cf_handle: values.cf_handle,
        codechef_handle: values.codechef_handle,
        vjudge_handle: values.vjudge_handle,
        beecrowd_handle: values.beecrowd_handle,
        hackerrank_handle: values.hackerrank_handle,
        github_username: values.github_username,
        consent,
      });

      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "form");
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }

      setErrors({});
      setLoading(true);

      const d = parsed.data;
      const { error } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: d.full_name,
            role: "member",
            student_id: d.student_id,
            batch: d.batch,
            contact: d.contact,
            cf_handle: d.cf_handle,
            codechef_handle: d.codechef_handle,
            vjudge_handle: d.vjudge_handle,
            beecrowd_handle: d.beecrowd_handle,
            hackerrank_handle: d.hackerrank_handle,
            github_username: d.github_username,
            consent: "true",
          },
        },
      });

      setLoading(false);
      if (error) {
        setFormError(
          "We could not create your account. The email or student ID may already be registered. Try signing in instead."
        );
        return;
      }
      setDone(true);
    } else {
      // Role is Advisor
      const parsed = advisorSignupSchema.safeParse({
        role: "advisor",
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        confirm_password: values.confirm_password,
        contact: values.contact,
        designation: values.designation,
        department: values.department,
        consent,
      });

      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "form");
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }

      setErrors({});
      setLoading(true);

      const d = parsed.data;
      const uniqueAdvId = `ADV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: d.full_name,
            role: "advisor",
            designation: d.designation,
            department: d.department,
            contact: d.contact,
            student_id: uniqueAdvId,
            batch: d.department,
            consent: "true",
          },
        },
      });

      if (signUpError) {
        setLoading(false);
        setFormError(
          "We could not create your advisor account. The email may already be registered. Try signing in instead."
        );
        return;
      }

      // Server-side profile upgrade to advisor
      if (signUpData.user?.id) {
        await registerAdvisorProfile(signUpData.user.id, {
          designation: d.designation,
          department: d.department,
          contact: d.contact,
          fullName: d.full_name,
        });
      }

      setLoading(false);
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 py-4 text-center">
        <div className="text-4xl">📧</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{values.email}</span>. After you confirm,
          a club administrator will review and activate your{" "}
          <span className="font-medium text-foreground">
            {role === "advisor" ? "advisor account" : "member account"}
          </span>.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {/* Role Selection Switcher */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sign up as
        </label>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => handleRoleChange("member")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
              role === "member"
                ? "border border-border bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-sm">👤</span>
            <span>Club Member</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange("advisor")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
              role === "advisor"
                ? "border border-border bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-sm">🎓</span>
            <span>Club Advisor</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {role === "member"
            ? "For student members participating in competitive programming, contests, and leaderboards."
            : "For faculty and academic advisors providing mentorship and oversight. Platform handles are not required."}
        </p>
      </div>

      {/* Account Section (Common) */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account Credentials
        </h2>
        <Field
          id="full_name"
          label="Full name"
          autoComplete="name"
          placeholder={role === "advisor" ? "e.g. Dr. Md. Ashikur Rahman" : "e.g. Rahim Uddin"}
          value={values.full_name}
          onChange={set("full_name")}
          error={errors.full_name}
        />
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder={role === "advisor" ? "advisor@nstu.edu.bd" : "you@example.com"}
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={values.password}
          onChange={set("password")}
          error={errors.password}
        />
        <Field
          id="confirm_password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirm_password}
          onChange={set("confirm_password")}
          error={errors.confirm_password}
        />
      </section>

      {/* Role-Specific Details */}
      {role === "member" ? (
        <>
          {/* Member: Club details */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Club details
            </h2>
            <Field
              id="student_id"
              label="Student ID"
              placeholder="e.g. 2301234"
              value={values.student_id}
              onChange={set("student_id")}
              error={errors.student_id}
            />
            <Field
              id="batch"
              label="Batch"
              hint="e.g. 45, 46, 47…"
              placeholder="45"
              value={values.batch}
              onChange={set("batch")}
              error={errors.batch}
            />
            <Field
              id="contact"
              label="Contact number"
              type="tel"
              autoComplete="tel"
              placeholder="+880 1700 000000"
              value={values.contact}
              onChange={set("contact")}
              error={errors.contact}
            />
          </section>

          {/* Member: Platform usernames */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Platform usernames
            </h2>
            <p className="text-xs text-muted-foreground">
              Enter only your username, not the full URL. Leave blank if you don&apos;t
              have an account on that platform.
            </p>
            <Field
              id="cf_handle"
              label="Codeforces"
              icon={<PlatformIcon platform="codeforces" className="h-4 w-4" />}
              optional
              placeholder="tourist"
              value={values.cf_handle}
              onChange={set("cf_handle")}
              error={errors.cf_handle}
            />
            <Field
              id="codechef_handle"
              label="CodeChef"
              icon={<PlatformIcon platform="codechef" className="h-4 w-4" />}
              optional
              placeholder="handle"
              value={values.codechef_handle}
              onChange={set("codechef_handle")}
              error={errors.codechef_handle}
            />
            <Field
              id="vjudge_handle"
              label="VJudge"
              icon={<PlatformIcon platform="vjudge" className="h-4 w-4" />}
              optional
              placeholder="handle"
              value={values.vjudge_handle}
              onChange={set("vjudge_handle")}
              error={errors.vjudge_handle}
            />
            <Field
              id="beecrowd_handle"
              label="Beecrowd"
              icon={<PlatformIcon platform="beecrowd" className="h-4 w-4" />}
              optional
              placeholder="142984"
              hint="Your numeric user ID from your profile URL"
              value={values.beecrowd_handle}
              onChange={set("beecrowd_handle")}
              error={errors.beecrowd_handle}
            />
            <Field
              id="hackerrank_handle"
              label="HackerRank"
              icon={<PlatformIcon platform="hackerrank" className="h-4 w-4" />}
              optional
              placeholder="handle"
              value={values.hackerrank_handle}
              onChange={set("hackerrank_handle")}
              error={errors.hackerrank_handle}
            />
            <Field
              id="github_username"
              label="GitHub"
              icon={<PlatformIcon platform="github" className="h-4 w-4" />}
              optional
              placeholder="octocat"
              value={values.github_username}
              onChange={set("github_username")}
              error={errors.github_username}
            />
          </section>

          {/* Member Consent */}
          <div className="space-y-1.5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span className="text-muted-foreground leading-relaxed">
                I agree that the club may collect my details and public activity on
                the platforms above, and that club advisors and admins can view them
                to track participation. My name, batch and activity scores will
                appear on a club leaderboard visible to other approved members, and
                I can hide myself from it at any time.
              </span>
            </label>
            {errors.consent && (
              <p role="alert" className="text-xs text-destructive pl-7">
                {errors.consent}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Advisor: Academic & Professional Details (No Handles) */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Advisor &amp; Academic Details
            </h2>
            <Field
              id="contact"
              label="Contact number"
              type="tel"
              autoComplete="tel"
              placeholder="+880 1700 000000"
              value={values.contact}
              onChange={set("contact")}
              error={errors.contact}
            />
            <Field
              id="designation"
              label="Designation"
              placeholder="e.g. Assistant Professor / Lecturer / Associate Professor"
              hint="Your official academic or administrative position"
              value={values.designation}
              onChange={set("designation")}
              error={errors.designation}
            />
            <Field
              id="department"
              label="Department"
              placeholder="e.g. Information & Communication Engineering (ICE)"
              hint="Your faculty or academic department"
              value={values.department}
              onChange={set("department")}
              error={errors.department}
            />
          </section>

          {/* Advisor Consent */}
          <div className="space-y-1.5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span className="text-muted-foreground leading-relaxed">
                I agree to join NSTU ICE Programming Club as an Advisor to provide
                academic guidance, supervision, and mentorship to club members. My
                advisor account will be activated upon super admin verification.
              </span>
            </label>
            {errors.consent && (
              <p role="alert" className="text-xs text-destructive pl-7">
                {errors.consent}
              </p>
            )}
          </div>
        </>
      )}

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Creating account…
          </span>
        ) : role === "advisor" ? (
          "Create Advisor Account"
        ) : (
          "Create Member Account"
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href="/login"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
