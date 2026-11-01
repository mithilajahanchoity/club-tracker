"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validation";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

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
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
        {props.optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputClass}
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
      <div className="space-y-3 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {values.email}. After you confirm, a
          club admin will review and approve your account.
        </p>
        <Link href="/login" className="text-sm underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <Field id="full_name" label="Full name" autoComplete="name" value={values.full_name} onChange={set("full_name")} error={errors.full_name} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={values.email} onChange={set("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters" value={values.password} onChange={set("password")} error={errors.password} />
        <Field id="confirm_password" label="Confirm password" type="password" autoComplete="new-password" value={values.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Club details
        </h2>
        <Field id="student_id" label="Student ID" value={values.student_id} onChange={set("student_id")} error={errors.student_id} />
        <Field id="batch" label="Batch" hint="Example: 45" value={values.batch} onChange={set("batch")} error={errors.batch} />
        <Field id="contact" label="Contact number" type="tel" autoComplete="tel" value={values.contact} onChange={set("contact")} error={errors.contact} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Platform usernames
        </h2>
        <p className="text-xs text-muted-foreground">
          Enter only the username, not the full link. Leave blank if you do not
          have an account.
        </p>
        <Field id="cf_handle" label="Codeforces" optional value={values.cf_handle} onChange={set("cf_handle")} error={errors.cf_handle} />
        <Field id="codechef_handle" label="CodeChef" optional value={values.codechef_handle} onChange={set("codechef_handle")} error={errors.codechef_handle} />
        <Field id="vjudge_handle" label="VJudge" optional value={values.vjudge_handle} onChange={set("vjudge_handle")} error={errors.vjudge_handle} />
        <Field id="beecrowd_handle" label="Beecrowd" optional value={values.beecrowd_handle} onChange={set("beecrowd_handle")} error={errors.beecrowd_handle} />
        <Field id="hackerrank_handle" label="HackerRank" optional value={values.hackerrank_handle} onChange={set("hackerrank_handle")} error={errors.hackerrank_handle} />
        <Field id="github_username" label="GitHub" optional value={values.github_username} onChange={set("github_username")} error={errors.github_username} />
      </section>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree that the club may collect my details and public activity on
            the platforms above, and that club advisors and admins can view
            them to track participation. I also understand that my name,
            batch and activity scores appear on a club leaderboard visible to
            other approved members, and that I can hide myself from it at any
            time. I understand that my name, batch and
            activity scores can appear on a leaderboard seen by other members,
            and that I can hide myself from it at any time.
          </span>
        </label>
        {errors.consent && (
          <p role="alert" className="text-xs text-destructive">
            {errors.consent}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
