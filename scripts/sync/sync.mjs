// Pulls public activity for approved members and stores it in Supabase.
//   Codeforces: solved problems per day, contest history, current rating
//   GitHub:     contributions per day
// Other platforms are skipped until their adapters exist.
//
// Run by .github/workflows/sync.yml. To test locally:
//   node --env-file=.env.local scripts/sync/sync.mjs --only=codeforces
//
// Needs: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//        GH_SYNC_TOKEN (only for GitHub). Secrets are never printed.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GH_TOKEN = process.env.GH_SYNC_TOKEN;
const CF_BASE = process.env.CF_API_BASE ?? "https://codeforces.com/api";
const GH_GRAPHQL = process.env.GITHUB_GRAPHQL_URL ?? "https://api.github.com/graphql";
const CF_DELAY_MS = Number(process.env.SYNC_CF_DELAY_MS ?? 2100); // Codeforces asks for ~1 call / 2 s
const WINDOW_DAYS = 30;
const TZ_OFFSET_HOURS = 6; // Bangladesh time, so "a day" matches the club's day
const USER_AGENT = "club-tracker-sync (university programming club project)";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null;
const platforms = ["codeforces", "github"].filter((p) => !only || p === only);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (platforms.includes("github") && !GH_TOKEN) {
  console.error("GH_SYNC_TOKEN is missing, so GitHub will be skipped.");
  platforms.splice(platforms.indexOf("github"), 1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function localDate(unixSeconds) {
  return new Date((unixSeconds + TZ_OFFSET_HOURS * 3600) * 1000)
    .toISOString()
    .slice(0, 10);
}

async function fetchJson(url, options = {}, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "User-Agent": USER_AGENT, ...(options.headers ?? {}) },
        signal: AbortSignal.timeout(20000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      return { status: res.status, body: await res.json().catch(() => null) };
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(3000 * (attempt + 1));
    }
  }
}

async function upsertRows(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ---------- Codeforces ----------

async function cfCall(method, params) {
  const url = `${CF_BASE}/${method}?${new URLSearchParams(params)}`;
  let result = await fetchJson(url);
  if (
    result.body?.status === "FAILED" &&
    /limit exceeded/i.test(result.body.comment ?? "")
  ) {
    await sleep(5000);
    result = await fetchJson(url);
  }
  await sleep(CF_DELAY_MS);
  if (result.body?.status !== "OK") {
    throw new Error(result.body?.comment ?? `HTTP ${result.status}`);
  }
  return result.body.result;
}

async function syncCodeforces(acct) {
  const COUNT = 2000;
  const subs = await cfCall("user.status", {
    handle: acct.handle,
    from: "1",
    count: String(COUNT),
  });
  const history = await cfCall("user.rating", { handle: acct.handle });

  // A problem counts as "solved" on the day of its first accepted submission.
  const firstAccepted = new Map();
  for (const s of subs) {
    if (s.verdict !== "OK" || !s.problem) continue;
    const key = `${s.problem.contestId ?? ""}-${s.problem.index}`;
    const prev = firstAccepted.get(key);
    if (prev === undefined || s.creationTimeSeconds < prev) {
      firstAccepted.set(key, s.creationTimeSeconds);
    }
  }

  // If the list was cut off at COUNT, the oldest day is incomplete: skip it.
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoff = nowSec - WINDOW_DAYS * 86400;
  let reliableFrom = 0;
  if (subs.length >= COUNT) {
    reliableFrom = Math.min(...subs.map((s) => s.creationTimeSeconds)) + 86400;
  }

  const perDay = new Map();
  for (const ts of firstAccepted.values()) {
    if (ts < cutoff || ts < reliableFrom) continue;
    const d = localDate(ts);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const dailyRows = [...perDay].map(([activity_date, solved]) => ({
    profile_id: acct.profile_id,
    platform: "codeforces",
    activity_date,
    solved,
  }));
  await upsertRows("activity_daily", dailyRows, "profile_id,platform,activity_date");

  // Current rating goes on today's row (separate upsert so it never wipes solved counts).
  if (history.length > 0) {
    await upsertRows(
      "activity_daily",
      [
        {
          profile_id: acct.profile_id,
          platform: "codeforces",
          activity_date: localDate(nowSec),
          rating: history[history.length - 1].newRating,
        },
      ],
      "profile_id,platform,activity_date"
    );
  }

  const contestRows = history.map((h) => ({
    profile_id: acct.profile_id,
    platform: "codeforces",
    contest_name: String(h.contestName).slice(0, 200),
    contest_date: localDate(h.ratingUpdateTimeSeconds),
    rank: h.rank,
    rating_change: h.newRating - h.oldRating,
  }));
  await upsertRows(
    "contest_participation",
    contestRows,
    "profile_id,platform,contest_name,contest_date"
  );

  return `${dailyRows.length} active days, ${contestRows.length} rated contests`;
}

// ---------- GitHub ----------

const GH_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function syncGithub(acct) {
  const to = new Date();
  const from = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const { status, body } = await fetchJson(GH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GH_QUERY,
      variables: {
        login: acct.handle,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (status === 401) throw new Error("GitHub token was rejected (expired or wrong)");
  if (!body?.data?.user) {
    throw new Error(body?.errors?.[0]?.message ?? `HTTP ${status}`);
  }

  const days =
    body.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(
      (w) => w.contributionDays
    );

  // "commits" column holds GitHub's contribution count (commits, PRs, issues, reviews).
  const rows = days
    .filter((d) => d.contributionCount > 0)
    .map((d) => ({
      profile_id: acct.profile_id,
      platform: "github",
      activity_date: d.date,
      commits: d.contributionCount,
    }));
  await upsertRows("activity_daily", rows, "profile_id,platform,activity_date");
  return `${rows.length} active days`;
}

// ---------- Runner ----------

const adapters = { codeforces: syncCodeforces, github: syncGithub };

async function runPlatform(platform, accounts, stats) {
  for (const acct of accounts) {
    try {
      const summary = await adapters[platform](acct);
      await supabase
        .from("platform_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", acct.id);
      stats.ok++;
      console.log(`ok   ${platform} ${acct.handle}: ${summary}`);
    } catch (err) {
      stats.failed++;
      console.log(`FAIL ${platform} ${acct.handle}: ${err.message}`);
    }
    if (platform === "github") await sleep(200);
  }
}

const { data: accounts, error } = await supabase
  .from("platform_accounts")
  .select("id, profile_id, platform, handle, profiles!inner(status)")
  .in("platform", platforms)
  .eq("profiles.status", "approved")
  .order("id");

if (error) {
  console.error("Could not load accounts:", error.message);
  process.exit(1);
}

const stats = { ok: 0, failed: 0 };
console.log(`Syncing ${accounts.length} accounts (${platforms.join(", ")})`);

// The two services are independent, so run them side by side.
await Promise.all(
  platforms.map((p) =>
    runPlatform(
      p,
      accounts.filter((a) => a.platform === p),
      stats
    )
  )
);

console.log(`Done: ${stats.ok} synced, ${stats.failed} failed`);
// Fail the run (GitHub emails you) only if nothing worked at all.
if (stats.failed > 0 && stats.ok === 0) process.exit(1);
