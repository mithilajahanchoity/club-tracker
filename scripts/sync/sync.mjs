// Pulls public activity for approved members and stores it in Supabase.
//   Codeforces: solved problems per day, contest history, current rating
//   GitHub:     contributions per day
//   Beecrowd:   solved problems, rank/rating
//   HackerRank: solved problems, badges/stars, contest history
// Other platforms are skipped until their adapters exist.
//
// Run by .github/workflows/sync.yml. To test locally:
//   node --env-file=.env.local scripts/sync/sync.mjs --only=codeforces
//   node --env-file=.env.local scripts/sync/sync.mjs --only=beecrowd
//   node --env-file=.env.local scripts/sync/sync.mjs --only=hackerrank
//
// Needs: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
//        GH_SYNC_TOKEN (only for GitHub). Secrets are never printed.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GH_TOKEN = process.env.GH_SYNC_TOKEN;
const CF_BASE = process.env.CF_API_BASE ?? "https://codeforces.com/api";
const GH_GRAPHQL = process.env.GITHUB_GRAPHQL_URL ?? "https://api.github.com/graphql";
const BEECROWD_TOKEN = process.env.BEECROWD_TOKEN;
const BEECROWD_COOKIE = process.env.BEECROWD_COOKIE;
const BEECROWD_PROXY = process.env.BEECROWD_PROXY_URL;
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const BEECROWD_BASE = process.env.BEECROWD_BASE_URL ?? "https://judge.beecrowd.com";
const HACKERRANK_BASE = process.env.HACKERRANK_BASE_URL ?? "https://www.hackerrank.com";
const HACKERRANK_PROXY = process.env.HACKERRANK_PROXY_URL;
const HACKERRANK_COOKIE = process.env.HACKERRANK_COOKIE;
const CF_DELAY_MS = Number(process.env.SYNC_CF_DELAY_MS ?? 2100); // Codeforces asks for ~1 call / 2 s
const TZ_OFFSET_HOURS = 6; // Bangladesh time, so "a day" matches the club's day
const USER_AGENT = "club-tracker-sync (university programming club project)";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null;
const platforms = ["codeforces", "github", "beecrowd", "hackerrank", "vjudge"].filter((p) => !only || p === only);

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
  const cutoff = nowSec - 365 * 86400; // Store up to 365 days for the 52-week heatmap
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
  // Sync up to 365 days of contributions for the 52-week calendar heatmap
  const from = new Date(Date.now() - 365 * 86400000);
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

// ---------- Beecrowd ----------

async function syncBeecrowd(acct) {
  const handle = encodeURIComponent(acct.handle.trim());
  let totalSolved = 0;
  let rank = null;
  let points = null;

  if (BEECROWD_TOKEN) {
    // Mode 1: Official API endpoint
    const apiUrl = `https://api.beecrowd.com.br/users/profile/${handle}`;
    const res = await fetchJson(apiUrl, {
      headers: {
        Authorization: `Bearer ${BEECROWD_TOKEN}`,
        Accept: "application/json",
      },
    });
    if (res.status === 200 && res.body) {
      totalSolved = Number(res.body.solved ?? res.body.problems_solved ?? 0);
      rank = res.body.rank ? Number(res.body.rank) : null;
      points = res.body.points ? Math.round(Number(res.body.points)) : null;
    } else {
      throw new Error(`Beecrowd API returned HTTP ${res.status}`);
    }
  } else if (FIRECRAWL_KEY) {
    // Mode 2: Firecrawl scraping engine (bypasses Cloudflare automatically)
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://judge.beecrowd.com/en/profile/${handle}`,
        formats: ["rawHtml", "html"],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!fcRes.ok) {
      throw new Error(`Firecrawl API returned HTTP ${fcRes.status}`);
    }

    const fcData = await fcRes.json().catch(() => null);
    const text = fcData?.data?.rawHtml || fcData?.data?.html || "";

    const solvedMatch =
      text.match(/class="profile-solved-number"[^>]*>(\d+)<\/span>/i) ||
      text.match(/Solved:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
      text.match(/Solucionados:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
      text.match(/(?:Solved|Solucionados)[^\d]{1,50}(\d+)/i) ||
      text.match(/class="[^"]*(?:statistic-value|number|solved)[^"]*"[^>]*>(\d+)<\/span>/i);

    const rankMatch =
      text.match(/class="profile-rank-text"[^>]*>([^<]+)<\/span>/i) ||
      text.match(/Rank:\s*<\/span>\s*<span[^>]*>([\d,]+)/i) ||
      text.match(/(?:Rank|Posição|Posicao)[^\d]{1,50}([\d,]+)/i);

    const pointsMatch =
      text.match(/class="profile-rank-points-text"[^>]*>([\d,.]+)<\/span>/i) ||
      text.match(/Points:\s*<\/span>\s*<span[^>]*>([\d,.]+)/i) ||
      text.match(/(?:Points|Pontos)[^\d]{1,50}([\d,.]+)/i);

    if (solvedMatch) {
      totalSolved = parseInt(solvedMatch[1], 10);
    } else {
      throw new Error("Could not parse solved problem count from profile page via Firecrawl.");
    }

    if (rankMatch) {
      const cleaned = rankMatch[1].replace(/,/g, "").trim();
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed)) rank = parsed;
    }
    if (pointsMatch) points = Math.round(parseFloat(pointsMatch[1].replace(/,/g, "")));
  } else {
    // Mode 3: Direct web scraping or proxy
    let fetchUrl = `${BEECROWD_BASE}/en/profile/${handle}`;
    if (BEECROWD_PROXY) {
      const rawProxy = BEECROWD_PROXY.trim();
      if (rawProxy.includes("{url}")) {
        fetchUrl = rawProxy.replace("{url}", encodeURIComponent(fetchUrl));
      } else {
        const sep = rawProxy.includes("?") ? "&" : "?";
        fetchUrl = `${rawProxy}${sep}url=${encodeURIComponent(fetchUrl)}`;
      }
    }

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (BEECROWD_COOKIE) {
      headers.Cookie = BEECROWD_COOKIE;
    }

    const res = await fetch(fetchUrl, {
      headers,
      signal: AbortSignal.timeout(BEECROWD_PROXY ? 25000 : 20000),
    });

    const text = await res.text();

    if (text.includes("Just a moment...") || res.status === 403) {
      throw new Error(
        "Cloudflare challenge active. Set BEECROWD_TOKEN, BEECROWD_COOKIE, or BEECROWD_PROXY_URL to sync."
      );
    } else if (res.status === 404) {
      throw new Error(`Profile not found for '${acct.handle}'`);
    } else if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}`);
    } else {
      const solvedMatch =
        text.match(/class="profile-solved-number"[^>]*>(\d+)<\/span>/i) ||
        text.match(/Solved:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/Solucionados:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/(?:Solved|Solucionados)[^\d]{1,50}(\d+)/i) ||
        text.match(/class="[^"]*(?:statistic-value|number|solved)[^"]*"[^>]*>(\d+)<\/span>/i);

      const rankMatch =
        text.match(/class="profile-rank-text"[^>]*>([^<]+)<\/span>/i) ||
        text.match(/Rank:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/(?:Rank|Posição|Posicao)[^\d]{1,50}(\d+)/i);

      const pointsMatch =
        text.match(/class="profile-rank-points-text"[^>]*>([\d,.]+)<\/span>/i) ||
        text.match(/Points:\s*<\/span>\s*<span[^>]*>([\d,.]+)/i) ||
        text.match(/(?:Points|Pontos)[^\d]{1,50}([\d,.]+)/i);

      if (solvedMatch) {
        totalSolved = parseInt(solvedMatch[1], 10);
      } else {
        throw new Error("Could not parse solved problem count from profile page.");
      }

      if (rankMatch) {
        const cleaned = rankMatch[1].replace(/,/g, "").trim();
        const parsed = parseInt(cleaned, 10);
        if (!isNaN(parsed)) rank = parsed;
      }
      if (pointsMatch) points = Math.round(parseFloat(pointsMatch[1].replace(/,/g, "")));
    }
  }

  const today = localDate(Math.floor(Date.now() / 1000));

  const { data: pastRows, error: qErr } = await supabase
    .from("activity_daily")
    .select("activity_date, solved")
    .eq("profile_id", acct.profile_id)
    .eq("platform", "beecrowd");

  if (qErr) throw new Error(`DB error: ${qErr.message}`);

  const previousSum = (pastRows ?? []).reduce((acc, r) => acc + (r.solved || 0), 0);
  const todayRow = (pastRows ?? []).find((r) => r.activity_date === today);
  const todaySolvedSoFar = todayRow?.solved ?? 0;

  let newDailySolved;
  if (previousSum === 0) {
    newDailySolved = totalSolved;
  } else {
    const delta = Math.max(0, totalSolved - previousSum);
    newDailySolved = todaySolvedSoFar + delta;
  }

  await upsertRows(
    "activity_daily",
    [
      {
        profile_id: acct.profile_id,
        platform: "beecrowd",
        activity_date: today,
        solved: newDailySolved,
        rating: rank ?? points ?? null,
      },
    ],
    "profile_id,platform,activity_date"
  );

  return `${totalSolved} total solved (${newDailySolved} credited today), rank: ${rank ?? "N/A"}`;
}

// ---------- HackerRank ----------

async function fetchHackerRankJson(path) {
  let url = `${HACKERRANK_BASE}${path}`;
  if (HACKERRANK_PROXY) {
    url = HACKERRANK_PROXY.includes("{url}")
      ? HACKERRANK_PROXY.replace("{url}", encodeURIComponent(url))
      : `${HACKERRANK_PROXY}?url=${encodeURIComponent(url)}`;
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (HACKERRANK_COOKIE) {
    headers.Cookie = HACKERRANK_COOKIE;
  }

  return fetchJson(url, { headers });
}

async function syncHackerrank(acct) {
  const handle = encodeURIComponent(acct.handle.trim());
  let totalSolved = 0;
  let rating = null;

  if (process.env.HACKERRANK_MOCK === "true") {
    totalSolved = 25;
    rating = 5;
    console.warn(`[DEV MOCK] Simulated stats for HackerRank ${acct.handle}`);
  } else {
    const [badgesRes, profileRes] = await Promise.all([
      fetchHackerRankJson(`/rest/hackers/${handle}/badges`),
      fetchHackerRankJson(`/rest/contests/master/hackers/${handle}/profile`),
    ]);

    if (badgesRes.status === 404 && profileRes.status === 404) {
      throw new Error(`Profile not found for '${acct.handle}'`);
    }

    if (badgesRes.status === 403 || profileRes.status === 403) {
      throw new Error(
        "Cloudflare/bot protection active on HackerRank. Set HACKERRANK_COOKIE or HACKERRANK_PROXY_URL, or test with HACKERRANK_MOCK=true."
      );
    }

    if (badgesRes.status >= 500 && profileRes.status >= 500) {
      throw new Error(`HackerRank API returned HTTP ${badgesRes.status}`);
    }

    const badges = Array.isArray(badgesRes.body?.models) ? badgesRes.body.models : [];
    const badgeSolved = badges.reduce((acc, b) => acc + (Number(b.solved) || 0), 0);
    const profileSolved = Number(profileRes.body?.model?.solved_challenges_count || 0);
    totalSolved = Math.max(badgeSolved, profileSolved);

    const totalStars = badges.reduce((acc, b) => acc + (Number(b.stars) || 0), 0);
    const level = profileRes.body?.model?.level ? Number(profileRes.body.model.level) : null;
    rating = totalStars > 0 ? totalStars : level;
  }

  const today = localDate(Math.floor(Date.now() / 1000));

  const { data: pastRows, error: qErr } = await supabase
    .from("activity_daily")
    .select("activity_date, solved")
    .eq("profile_id", acct.profile_id)
    .eq("platform", "hackerrank");

  if (qErr) throw new Error(`DB error: ${qErr.message}`);

  const previousSum = (pastRows ?? []).reduce((acc, r) => acc + (r.solved || 0), 0);
  const todayRow = (pastRows ?? []).find((r) => r.activity_date === today);
  const todaySolvedSoFar = todayRow?.solved ?? 0;

  let newDailySolved;
  if (previousSum === 0) {
    newDailySolved = totalSolved;
  } else {
    const delta = Math.max(0, totalSolved - previousSum);
    newDailySolved = todaySolvedSoFar + delta;
  }

  await upsertRows(
    "activity_daily",
    [
      {
        profile_id: acct.profile_id,
        platform: "hackerrank",
        activity_date: today,
        solved: newDailySolved,
        rating: rating ?? null,
      },
    ],
    "profile_id,platform,activity_date"
  );

  // Attempt contest history (non-blocking)
  try {
    if (process.env.HACKERRANK_MOCK !== "true") {
      const contestRes = await fetchHackerRankJson(`/rest/hackers/${handle}/rating_histories_elo`);
      const contestModels = contestRes.body?.models ?? [];
      if (Array.isArray(contestModels) && contestModels.length > 0) {
        const contestRows = contestModels
          .filter((c) => c.contest_name && c.date)
          .map((c) => ({
            profile_id: acct.profile_id,
            platform: "hackerrank",
            contest_name: String(c.contest_name).slice(0, 200),
            contest_date: localDate(Math.floor(new Date(c.date).getTime() / 1000)),
            rank: c.rank ? Number(c.rank) : null,
            rating_change: c.rating_change ? Number(c.rating_change) : null,
          }));
        if (contestRows.length > 0) {
          await upsertRows(
            "contest_participation",
            contestRows,
            "profile_id,platform,contest_name,contest_date"
          );
        }
      }
    }
  } catch {
    // Non-fatal if contest history is unavailable
  }

  return `${totalSolved} total solved (${newDailySolved} credited today), badges/rating: ${rating ?? "N/A"}`;
}

// ---------- VJudge ----------

async function syncVjudge(acct) {
  const clean = acct.handle.trim();
  const vjudgeBase = process.env.VJUDGE_BASE_URL ?? "https://vjudge.net";

  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  const res = await fetch(`${vjudgeBase}/user/${encodeURIComponent(clean)}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 404) {
    throw new Error(`VJudge user '${clean}' not found.`);
  }

  let totalSolved = 0;
  let rank = null;

  if (res.ok) {
    const html = await res.text();
    const headerMatch = html.match(/id="profile-header-data">([\s\S]*?)<\/script>/i);
    if (headerMatch) {
      try {
        const parsed = JSON.parse(headerMatch[1]);
        if (typeof parsed?.counts?.acAll === "number") totalSolved = parsed.counts.acAll;
        if (typeof parsed?.ranks?.all === "number") rank = parsed.ranks.all;
      } catch {}
    }
  }

  // Fetch daily solve stats for history
  const statsRes = await fetch(`${vjudgeBase}/user/dailySolveStat/${encodeURIComponent(clean)}`, {
    headers: {
      ...headers,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  const dayMap = new Map();
  if (statsRes.ok) {
    const statsData = await statsRes.json().catch(() => null);
    if (Array.isArray(statsData)) {
      for (const entry of statsData) {
        if (Array.isArray(entry) && entry[0] > 0) {
          const firstAcSec = entry[0];
          const dateStr = localDate(firstAcSec);
          dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + 1);
        }
      }
    }
  }

  if (dayMap.size > 0) {
    const dailyRows = [...dayMap].map(([activity_date, solved]) => ({
      profile_id: acct.profile_id,
      platform: "vjudge",
      activity_date,
      solved,
      rating: rank,
    }));
    await upsertRows("activity_daily", dailyRows, "profile_id,platform,activity_date");
  } else if (totalSolved > 0) {
    const today = localDate(Math.floor(Date.now() / 1000));
    await upsertRows(
      "activity_daily",
      [
        {
          profile_id: acct.profile_id,
          platform: "vjudge",
          activity_date: today,
          solved: totalSolved,
          rating: rank,
        },
      ],
      "profile_id,platform,activity_date"
    );
  }

  return `${totalSolved} total solved problems, rank: ${rank ? "#" + rank : "N/A"}`;
}

// ---------- Runner ----------

const adapters = {
  codeforces: syncCodeforces,
  github: syncGithub,
  beecrowd: syncBeecrowd,
  hackerrank: syncHackerrank,
  vjudge: syncVjudge,
};

async function runPlatform(platform, accounts, stats) {
  for (const acct of accounts) {
    try {
      const summary = await adapters[platform](acct);
      await supabase
        .from("platform_accounts")
        .update({
          verified: true,
          last_synced_at: new Date().toISOString(),
        })
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
  .select("id, profile_id, platform, handle, profiles!inner(status, role)")
  .in("platform", platforms)
  .eq("profiles.status", "approved")
  .eq("profiles.role", "member")
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
