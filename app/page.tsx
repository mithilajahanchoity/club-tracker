"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ error }) => {
      setStatus(error ? "Error: " + error.message : "Supabase connected");
    });
  }, []);

  return <main style={{ padding: 40 }}>{status}</main>;
}