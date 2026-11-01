"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validation";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors";

type Values = {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  student_id: string;
  batch: string;
  contact: string;
  cf_handle: string;
  codechef_handle: string;
  vjudge_handle: string;
  beecrowd_handle: string;
  hackerrank_handle: string;
  github_username: string;
};

const empty: Values = {
  full_name: "",
  email: "",
  password: "",
  confirm_password: "",
  student_id: "",
  batch: "",
  contact: "",
  cf_handle: "",
  codechef_handle: "",
  vjudge_handle: "",
  beecrowd_handle: "",
  hackerrank_handle: "",
  github_username: "",
};

function Field(props: {
  id: keyof Values;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
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
  const [values, setValues] = useState<Values>(empty);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof Values) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = signupSchema.safeParse({ ...values, consent });
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
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: d.full_name,
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
  }

  if (done) {
    return (
      <div className="space-y-4 py-4 text-center">
        <div className="text-4xl">📧</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium">{values.email}</span>. After you confirm,
          a club admin will review and approve your account.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <Field id="full_name" label="Full name" autoComplete="name" placeholder="Rahim Uddin" value={values.full_name} onChange={set("full_name")} error={errors.full_name} />
        <Field id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={set("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters" value={values.password} onChange={set("password")} error={errors.password} />
        <Field id="confirm_password" label="Confirm password" type="password" autoComplete="new-password" value={values.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Club details
        </h2>
        <Field id="student_id" label="Student ID" placeholder="2301234" value={values.student_id} onChange={set("student_id")} error={errors.student_id} />
        <Field id="batch" label="Batch" hint="e.g. 45, 46, 47…" placeholder="45" value={values.batch} onChange={set("batch")} error={errors.batch} />
        <Field id="contact" label="Contact number" type="tel" autoComplete="tel" placeholder="+880 1700 000000" value={values.contact} onChange={set("contact")} error={errors.contact} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Platform usernames
        </h2>
        <p className="text-xs text-muted-foreground">
          Enter only your username, not the full URL. Leave blank if you don&apos;t
          have an account on that platform.
        </p>
        <Field id="cf_handle" label="Codeforces" optional placeholder="tourist" value={values.cf_handle} onChange={set("cf_handle")} error={errors.cf_handle} />
        <Field id="codechef_handle" label="CodeChef" optional placeholder="handle" value={values.codechef_handle} onChange={set("codechef_handle")} error={errors.codechef_handle} />
        <Field id="vjudge_handle" label="VJudge" optional placeholder="handle" value={values.vjudge_handle} onChange={set("vjudge_handle")} error={errors.vjudge_handle} />
        <Field id="beecrowd_handle" label="Beecrowd" optional placeholder="142984" hint="Your numeric user ID from your profile URL" value={values.beecrowd_handle} onChange={set("beecrowd_handle")} error={errors.beecrowd_handle} />
        <Field id="hackerrank_handle" label="HackerRank" optional placeholder="handle" value={values.hackerrank_handle} onChange={set("hackerrank_handle")} error={errors.hackerrank_handle} />
        <Field id="github_username" label="GitHub" optional placeholder="octocat" value={values.github_username} onChange={set("github_username")} error={errors.github_username} />
      </section>

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

      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
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
        ) : (
          "Create account"
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
