import { z } from "zod";

const handle = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9._-]{1,64}$/,
    "Use letters, numbers, dot, dash or underscore only"
  )
  .or(z.literal(""));

export const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use at most 72 characters"),
    confirm_password: z.string(),
    student_id: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{3,20}$/, "3-20 letters, numbers or dashes"),
    batch: z.string().trim().min(1, "Enter your batch").max(20),
    contact: z
      .string()
      .trim()
      .regex(/^[+0-9][0-9 -]{6,19}$/, "Enter a valid phone number"),
    cf_handle: handle,
    codechef_handle: handle,
    vjudge_handle: handle,
    beecrowd_handle: handle,
    hackerrank_handle: handle,
    github_username: handle,
    consent: z
      .boolean()
      .refine((v) => v === true, "You must accept to create an account"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
