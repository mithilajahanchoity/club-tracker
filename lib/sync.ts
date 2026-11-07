import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCodeChefPublicDetails } from "@/lib/codechef";
import { getLeetCodePublicDetails } from "@/lib/leetcode";

const WINDOW_DAYS = 30;
const TZ_OFFSET_HOURS = 6; // Bangladesh time (UTC+6)
const USER_AGENT = "club-tracker-sync (university programming club project)";

function localDate(unixSeconds: number) {
  return new Date((unixSeconds + TZ_OFFSET_HOURS * 3600) * 1000)
    .toISOString()
    .slice(0, 10);
}

export type SyncResult = {
  success: boolean;
  message: string;
  error?: string;
};

// ----------------- Codeforces Sync -----------------
async function syncCodeforces(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const cleanHandle = handle.trim();
  const cfBase = process.env.CF_API_BASE ?? "https://codeforces.com/api";

  const [subsRes, ratingRes] = await Promise.all([
    fetch(`${cfBase}/user.status?handle=${encodeURIComponent(cleanHandle)}&from=1&count=2000`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`${cfBase}/user.rating?handle=${encodeURIComponent(cleanHandle)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    }),
  ]);

  const subsData = await subsRes.json().catch(() => null);
  const ratingData = await ratingRes.json().catch(() => null);

  if (subsData?.status !== "OK") {
    throw new Error(subsData?.comment || `Codeforces account '${cleanHandle}' not found or API error.`);
  }

  const subs = subsData.result || [];
  const history = ratingData?.result || [];

  const firstAccepted = new Map<string, number>();
  for (const s of subs) {
    if (s.verdict !== "OK" || !s.problem) continue;
    const key = `${s.problem.contestId ?? ""}-${s.problem.index}`;
    const prev = firstAccepted.get(key);
    if (prev === undefined || s.creationTimeSeconds < prev) {
      firstAccepted.set(key, s.creationTimeSeconds);
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Store up to 365 days of daily solve activity for the 52-week heatmap
  const cutoff = nowSec - 365 * 86400;
  const perDay = new Map<string, number>();

  for (const ts of firstAccepted.values()) {
    if (ts < cutoff) continue;
    const d = localDate(ts);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const dailyRows = [...perDay].map(([activity_date, solved]) => ({
    profile_id: profileId,
    platform: "codeforces",
    activity_date,
    solved,
  }));

  if (dailyRows.length > 0) {
    await admin.from("activity_daily").upsert(dailyRows, {
      onConflict: "profile_id,platform,activity_date",
    });
  }

  if (history.length > 0) {
    const currentRating = history[history.length - 1].newRating;
    await admin.from("activity_daily").upsert(
      [
        {
          profile_id: profileId,
          platform: "codeforces",
          activity_date: localDate(nowSec),
          rating: currentRating,
        },
      ],
      { onConflict: "profile_id,platform,activity_date" }
    );

    const contestRows = history.map((h: { contestName: string; ratingUpdateTimeSeconds: number; rank: number; newRating: number; oldRating: number }) => ({
      profile_id: profileId,
      platform: "codeforces",
      contest_name: String(h.contestName).slice(0, 200),
      contest_date: localDate(h.ratingUpdateTimeSeconds),
      rank: h.rank,
      rating_change: h.newRating - h.oldRating,
    }));

    if (contestRows.length > 0) {
      await admin.from("contest_participation").upsert(contestRows, {
        onConflict: "profile_id,platform,contest_name,contest_date",
      });
    }
  }

  return `Codeforces: ${firstAccepted.size} total solved problems, ${history.length} rated contests.`;
}

// ----------------- Beecrowd Sync -----------------
async function syncBeecrowd(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const cleanId = handle.trim();
  const beecrowdBase = process.env.BEECROWD_BASE_URL ?? "https://judge.beecrowd.com";
  let fetchUrl = `${beecrowdBase}/en/profile/${encodeURIComponent(cleanId)}`;

  if (process.env.BEECROWD_PROXY_URL) {
    const rawProxy = process.env.BEECROWD_PROXY_URL.trim();
    if (rawProxy.includes("{url}")) {
      fetchUrl = rawProxy.replace("{url}", encodeURIComponent(fetchUrl));
    } else {
      const sep = rawProxy.includes("?") ? "&" : "?";
      fetchUrl = `${rawProxy}${sep}url=${encodeURIComponent(fetchUrl)}`;
    }
  }

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  if (process.env.BEECROWD_COOKIE) {
    headers.Cookie = process.env.BEECROWD_COOKIE;
  }

  let totalSolved = 0;
  let rank: number | null = null;
  let points: number | null = null;

  try {
    let text = "";

    if (process.env.FIRECRAWL_API_KEY) {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://judge.beecrowd.com/en/profile/${encodeURIComponent(cleanId)}`,
          formats: ["rawHtml", "html"],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!fcRes.ok) {
        throw new Error(`Firecrawl API error: HTTP ${fcRes.status}`);
      }

      const fcData = await fcRes.json().catch(() => null);
      text = fcData?.data?.rawHtml || fcData?.data?.html || "";
    } else {
      const res = await fetch(fetchUrl, {
        headers,
        signal: AbortSignal.timeout(process.env.BEECROWD_PROXY_URL ? 25000 : 15000),
      });

      if (res.status === 404) {
        throw new Error(`Beecrowd user profile '${cleanId}' not found.`);
      }

      text = await res.text();
    }

    const isCloudflare = text.includes("Just a moment...") || text.includes("cf-browser-verification");

    if (isCloudflare) {
      throw new Error(
        "Cloudflare challenge active on Beecrowd. Add FIRECRAWL_API_KEY or BEECROWD_COOKIE in .env.local, or use 'Set Solved Count'."
      );
    } else {
      const solvedMatch =
        text.match(/class="profile-solved-number"[^>]*>(\d+)<\/span>/i) ||
        text.match(/Solved:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/Solucionados:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/(?:Solved|Solucionados)[^\d]{1,50}(\d+)/i);

      const rankMatch =
        text.match(/class="profile-rank-text"[^>]*>([^<]+)<\/span>/i) ||
        text.match(/Rank:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        text.match(/(?:Rank|Posição|Posicao)[^\d]{1,50}(\d+)/i);

      const pointsMatch =
        text.match(/class="profile-rank-points-text"[^>]*>([\d,.]+)<\/span>/i) ||
        text.match(/Points:\s*<\/span>\s*<span[^>]*>([\d,.]+)/i) ||
        text.match(/(?:Points|Pontos)[^\d]{1,50}([\d,.]+)/i);

      if (solvedMatch) totalSolved = parseInt(solvedMatch[1], 10);
      if (rankMatch) {
        const cleaned = rankMatch[1].replace(/,/g, "").trim();
        const parsed = parseInt(cleaned, 10);
        if (!isNaN(parsed)) rank = parsed;
      }
      if (pointsMatch) points = Math.round(parseFloat(pointsMatch[1].replace(/,/g, "")));

      // Extract cal.init history if present to backfill historical days in the window
      const calMatch = text.match(/cal\.init\(\{[\s\S]*?data:\s*(\{[\s\S]*?\}|\[\])/);
      if (calMatch && calMatch[1].startsWith("{")) {
        try {
          const rawData = JSON.parse(calMatch[1]);
          const cutoffSec = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;
          const dayMap = new Map<string, number>();
          for (const [secStr, count] of Object.entries(rawData)) {
            const sec = Number(secStr);
            if (!isNaN(sec) && sec >= cutoffSec) {
              const d = localDate(sec);
              dayMap.set(d, (dayMap.get(d) ?? 0) + Number(count || 1));
            }
          }
          if (dayMap.size > 0) {
            const historyRows = [...dayMap].map(([activity_date, solved]) => ({
              profile_id: profileId,
              platform: "beecrowd",
              activity_date,
              solved,
              rating: rank ?? points ?? null,
            }));
            await admin.from("activity_daily").upsert(historyRows, {
              onConflict: "profile_id,platform,activity_date",
            });
          }
        } catch {
          // Ignore cal.init parse errors
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("not found") || err.message.includes("Cloudflare"))) {
      throw err;
    }
  }

  const today = localDate(Math.floor(Date.now() / 1000));
  const { data: pastRows } = await admin
    .from("activity_daily")
    .select("activity_date, solved")
    .eq("profile_id", profileId)
    .eq("platform", "beecrowd");

  const previousSum = (pastRows ?? []).reduce((acc, r) => acc + (r.solved || 0), 0);
  const todayRow = (pastRows ?? []).find((r) => r.activity_date === today);
  const todaySolvedSoFar = todayRow?.solved ?? 0;

  const resolvedSolved = totalSolved > 0 ? totalSolved : previousSum;
  let newDailySolved = todaySolvedSoFar;
  if (previousSum === 0) {
    newDailySolved = resolvedSolved;
  } else if (resolvedSolved > previousSum) {
    newDailySolved = todaySolvedSoFar + (resolvedSolved - previousSum);
  }

  await admin.from("activity_daily").upsert(
    [
      {
        profile_id: profileId,
        platform: "beecrowd",
        activity_date: today,
        solved: newDailySolved,
        rating: rank ?? points ?? null,
      },
    ],
    { onConflict: "profile_id,platform,activity_date" }
  );

  return `Beecrowd: ${resolvedSolved} solved problems recorded, rank: ${rank ? "#" + rank : "N/A"}.`;
}

// ----------------- HackerRank Sync -----------------
async function syncHackerRank(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const cleanHandle = handle.trim();
  const hrBase = process.env.HACKERRANK_BASE_URL ?? "https://www.hackerrank.com";

  const [badgesRes, profileRes, contestRes] = await Promise.all([
    fetch(`${hrBase}/rest/hackers/${encodeURIComponent(cleanHandle)}/badges`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`${hrBase}/rest/contests/master/hackers/${encodeURIComponent(cleanHandle)}/profile`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`${hrBase}/rest/hackers/${encodeURIComponent(cleanHandle)}/rating_histories_elo`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    }),
  ]);

  if (badgesRes.status === 404 && profileRes.status === 404) {
    throw new Error(`HackerRank user profile '${cleanHandle}' not found.`);
  }

  const badgesData = await badgesRes.json().catch(() => null);
  const profileData = await profileRes.json().catch(() => null);
  const contestData = await contestRes.json().catch(() => null);

  const badges = Array.isArray(badgesData?.models) ? badgesData.models : [];
  const badgeSolved = badges.reduce((acc: number, b: { solved?: number }) => acc + (Number(b.solved) || 0), 0);
  const profileSolved = Number(profileData?.model?.solved_challenges_count || 0);
  const totalSolved = Math.max(badgeSolved, profileSolved);

  const totalStars = badges.reduce((acc: number, b: { stars?: number }) => acc + (Number(b.stars) || 0), 0);
  const level = profileData?.model?.level ? Number(profileData.model.level) : null;
  const rating = totalStars > 0 ? totalStars : level;

  const today = localDate(Math.floor(Date.now() / 1000));
  const { data: pastRows } = await admin
    .from("activity_daily")
    .select("activity_date, solved")
    .eq("profile_id", profileId)
    .eq("platform", "hackerrank");

  const previousSum = (pastRows ?? []).reduce((acc, r) => acc + (r.solved || 0), 0);
  const todayRow = (pastRows ?? []).find((r) => r.activity_date === today);
  const todaySolvedSoFar = todayRow?.solved ?? 0;

  let newDailySolved: number;
  if (previousSum === 0) {
    newDailySolved = totalSolved;
  } else {
    const delta = Math.max(0, totalSolved - previousSum);
    newDailySolved = todaySolvedSoFar + delta;
  }

  await admin.from("activity_daily").upsert(
    [
      {
        profile_id: profileId,
        platform: "hackerrank",
        activity_date: today,
        solved: newDailySolved,
        rating,
      },
    ],
    { onConflict: "profile_id,platform,activity_date" }
  );

  const contestModels = contestData?.models ?? [];
  if (Array.isArray(contestModels) && contestModels.length > 0) {
    const contestRows = contestModels
      .filter((c: { contest_name?: string; date?: string }) => c.contest_name && c.date)
      .map((c: { contest_name: string; date: string; rank?: number; rating_change?: number }) => ({
        profile_id: profileId,
        platform: "hackerrank",
        contest_name: String(c.contest_name).slice(0, 200),
        contest_date: localDate(Math.floor(new Date(c.date).getTime() / 1000)),
        rank: c.rank ? Number(c.rank) : null,
        rating_change: c.rating_change ? Number(c.rating_change) : null,
      }));

    if (contestRows.length > 0) {
      await admin.from("contest_participation").upsert(contestRows, {
        onConflict: "profile_id,platform,contest_name,contest_date",
      });
    }
  }

  return `HackerRank: ${totalSolved} total solved problems, ${badges.length} skill badges.`;
}

// ----------------- GitHub Sync -----------------
async function syncGitHub(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const cleanHandle = handle.trim();
  const token = process.env.GH_SYNC_TOKEN;

  if (token) {
    // Sync up to 365 days of contributions for the 52-week calendar heatmap
    const from = new Date(Date.now() - 365 * 86400000).toISOString();
    const to = new Date().toISOString();
    const ghQuery = `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              weeks { contributionDays { date contributionCount } }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        query: ghQuery,
        variables: { login: cleanHandle, from, to },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => null);
    if (!data?.data?.user) {
      throw new Error(`GitHub user '${cleanHandle}' not found or token error.`);
    }

    const days: Array<{ date: string; contributionCount: number }> =
      data.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(
        (w: { contributionDays: Array<{ date: string; contributionCount: number }> }) => w.contributionDays
      );

    const rows = days
      .filter((d) => d.contributionCount > 0)
      .map((d) => ({
        profile_id: profileId,
        platform: "github",
        activity_date: d.date,
        commits: d.contributionCount,
      }));

    if (rows.length > 0) {
      await admin.from("activity_daily").upsert(rows, {
        onConflict: "profile_id,platform,activity_date",
      });
    }

    const totalContribs = days.reduce((acc, d) => acc + d.contributionCount, 0);
    return `GitHub: ${totalContribs} contributions across past ${WINDOW_DAYS} days.`;
  }

  // Fallback if token not provided
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) {
    throw new Error(`GitHub user '${cleanHandle}' not found.`);
  }

  return `GitHub: Profile verified (@${cleanHandle}).`;
}

// ----------------- VJudge Sync -----------------
async function syncVJudge(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const clean = handle.trim();
  const vjudgeBase = process.env.VJUDGE_BASE_URL ?? "https://vjudge.net";

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  const [profileRes, statsRes] = await Promise.all([
    fetch(`${vjudgeBase}/user/${encodeURIComponent(clean)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    }),
    fetch(`${vjudgeBase}/user/dailySolveStat/${encodeURIComponent(clean)}`, {
      headers: {
        ...headers,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    }),
  ]);

  if (profileRes.status === 404) {
    throw new Error(`VJudge user '${clean}' not found.`);
  }

  let totalSolved = 0;
  let rank: number | null = null;

  if (profileRes.ok) {
    const html = await profileRes.text();
    const headerMatch = html.match(/id="profile-header-data">([\s\S]*?)<\/script>/i);
    if (headerMatch) {
      try {
        const parsed = JSON.parse(headerMatch[1]);
        if (typeof parsed?.counts?.acAll === "number") totalSolved = parsed.counts.acAll;
        if (typeof parsed?.ranks?.all === "number") rank = parsed.ranks.all;
      } catch {
        // Ignore JSON parse error
      }
    }
  }

  const dayMap = new Map<string, number>();
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
      profile_id: profileId,
      platform: "vjudge",
      activity_date,
      solved,
      rating: rank,
    }));
    await admin.from("activity_daily").upsert(dailyRows, {
      onConflict: "profile_id,platform,activity_date",
    });
  } else if (totalSolved > 0) {
    const today = localDate(Math.floor(Date.now() / 1000));
    await admin.from("activity_daily").upsert(
      [
        {
          profile_id: profileId,
          platform: "vjudge",
          activity_date: today,
          solved: totalSolved,
          rating: rank,
        },
      ],
      { onConflict: "profile_id,platform,activity_date" }
    );
  }

  return `VJudge: ${totalSolved} total solved problems, rank: ${rank ? "#" + rank : "N/A"}.`;
}


// ----------------- CodeChef Sync -----------------
async function syncCodeChef(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const cleanHandle = handle.trim();
  const profile = await getCodeChefPublicDetails(cleanHandle);

  if (!profile) {
    throw new Error(`CodeChef user '${cleanHandle}' not found or unreachable.`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const today = localDate(nowSec);

  // 1. Daily solves from activityMap (heatmap data)
  const dailyRows: Array<{
    profile_id: string;
    platform: string;
    activity_date: string;
    solved: number;
    rating?: number | null;
  }> = [];

  for (const [activity_date, solved] of Object.entries(profile.activityMap)) {
    if (solved > 0) {
      dailyRows.push({
        profile_id: profileId,
        platform: "codechef",
        activity_date,
        solved,
      });
    }
  }

  // If no heatmap daily data was returned but totalSolved > 0, record total for today
  if (dailyRows.length === 0 && profile.totalSolved > 0) {
    dailyRows.push({
      profile_id: profileId,
      platform: "codechef",
      activity_date: today,
      solved: profile.totalSolved,
    });
  }

  if (dailyRows.length > 0) {
    await admin.from("activity_daily").upsert(dailyRows, {
      onConflict: "profile_id,platform,activity_date",
    });
  }

  // 2. Current rating
  if (profile.rating != null) {
    await admin.from("activity_daily").upsert(
      [
        {
          profile_id: profileId,
          platform: "codechef",
          activity_date: today,
          rating: profile.rating,
        },
      ],
      { onConflict: "profile_id,platform,activity_date" }
    );
  }

  // 3. Contest participations
  if (profile.contestHistory.length > 0) {
    const contestRows = profile.contestHistory.map((c) => ({
      profile_id: profileId,
      platform: "codechef",
      contest_name: String(c.name).slice(0, 200),
      contest_date: c.dateIso || today,
      rank: c.rank || null,
      rating_change: c.ratingChange || null,
    }));

    await admin.from("contest_participation").upsert(contestRows, {
      onConflict: "profile_id,platform,contest_name,contest_date",
    });
  }

  const starsBadge = profile.stars ? ` (${profile.stars})` : "";
  const ratingText = profile.rating ? `rating: ${profile.rating}${starsBadge}` : "unrated";
  return `CodeChef: ${profile.totalSolved} solved, ${ratingText}, ${profile.contestHistory.length} contests synced.`;
}

// ----------------- LeetCode Sync -----------------
async function syncLeetCode(admin: ReturnType<typeof createAdminClient>, profileId: string, handle: string) {
  const profile = await getLeetCodePublicDetails(handle);
  if (!profile) {
    throw new Error(`LeetCode account '${handle}' not found or unreachable.`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const today = localDate(nowSec);

  // 1. Daily solves from activityMap (heatmap data)
  const dailyRows: Array<{
    profile_id: string;
    platform: string;
    activity_date: string;
    solved: number;
    rating?: number | null;
  }> = [];

  for (const [activity_date, solved] of Object.entries(profile.activityMap)) {
    if (solved > 0) {
      dailyRows.push({
        profile_id: profileId,
        platform: "leetcode",
        activity_date,
        solved,
      });
    }
  }

  // If no heatmap daily data was returned but totalSolved > 0, record total for today
  if (dailyRows.length === 0 && profile.totalSolved > 0) {
    dailyRows.push({
      profile_id: profileId,
      platform: "leetcode",
      activity_date: today,
      solved: profile.totalSolved,
    });
  }

  if (dailyRows.length > 0) {
    await admin.from("activity_daily").upsert(dailyRows, {
      onConflict: "profile_id,platform,activity_date",
    });
  }

  // 2. Current contest rating
  if (profile.contestRating != null) {
    await admin.from("activity_daily").upsert(
      [
        {
          profile_id: profileId,
          platform: "leetcode",
          activity_date: today,
          rating: profile.contestRating,
        },
      ],
      { onConflict: "profile_id,platform,activity_date" }
    );
  }

  // 3. Contest participations
  if (profile.contestHistory.length > 0) {
    const contestRows = profile.contestHistory.map((c) => ({
      profile_id: profileId,
      platform: "leetcode",
      contest_name: String(c.title).slice(0, 200),
      contest_date: c.dateIso || today,
      rank: c.ranking || null,
      rating_change: c.ratingChange || null,
    }));

    await admin.from("contest_participation").upsert(contestRows, {
      onConflict: "profile_id,platform,contest_name,contest_date",
    });
  }

  const badgeText = profile.contestBadge ? ` (${profile.contestBadge})` : "";
  const ratingText = profile.contestRating ? `rating: ${profile.contestRating}${badgeText}` : "unrated";
  return `LeetCode: ${profile.totalSolved} solved (${profile.easySolved}E / ${profile.mediumSolved}M / ${profile.hardSolved}H), ${ratingText}, ${profile.contestHistory.length} contests synced.`;
}

async function syncGenericPlatform(platform: string, handle: string) {
  const clean = handle.trim();
  const url = `https://www.codechef.com/users/${encodeURIComponent(clean)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });

  if (res.status === 404) {
    throw new Error(`${platform} user '${clean}' not found.`);
  }

  return `${platform}: Handle verified.`;
}

// ----------------- Public Main Dispatcher -----------------
export async function syncSingleAccount(profileId: string, platform: string): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: acct, error } = await admin
    .from("platform_accounts")
    .select("id, profile_id, platform, handle, verified")
    .eq("profile_id", profileId)
    .eq("platform", platform)
    .maybeSingle();

  if (error || !acct) {
    return {
      success: false,
      message: `No ${platform} account found for this member.`,
      error: error?.message,
    };
  }

  try {
    let summary = "";
    if (platform === "codeforces") {
      summary = await syncCodeforces(admin, profileId, acct.handle);
    } else if (platform === "beecrowd") {
      summary = await syncBeecrowd(admin, profileId, acct.handle);
    } else if (platform === "hackerrank") {
      summary = await syncHackerRank(admin, profileId, acct.handle);
    } else if (platform === "github") {
      summary = await syncGitHub(admin, profileId, acct.handle);
    } else if (platform === "vjudge") {
      summary = await syncVJudge(admin, profileId, acct.handle);
    } else if (platform === "codechef") {
      summary = await syncCodeChef(admin, profileId, acct.handle);
    } else if (platform === "leetcode") {
      summary = await syncLeetCode(admin, profileId, acct.handle);
    } else {
      summary = await syncGenericPlatform(platform, acct.handle);
    }

    // Set verified = true and last_synced_at = now
    await admin
      .from("platform_accounts")
      .update({
        verified: true,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", acct.id);

    return {
      success: true,
      message: summary,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Sync failed";
    return {
      success: false,
      message: errorMsg,
      error: errorMsg,
    };
  }
}

// ----------------- Manual Stat Setting (For Cloudflare Workaround) -----------------
export async function manualSetBeecrowdStats(
  profileId: string,
  solved: number,
  rank?: number | null
): Promise<SyncResult> {
  const admin = createAdminClient();
  const today = localDate(Math.floor(Date.now() / 1000));

  await admin.from("activity_daily").upsert(
    [
      {
        profile_id: profileId,
        platform: "beecrowd",
        activity_date: today,
        solved: Math.max(0, solved),
        rating: rank ?? null,
      },
    ],
    { onConflict: "profile_id,platform,activity_date" }
  );

  await admin
    .from("platform_accounts")
    .update({
      verified: true,
      last_synced_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .eq("platform", "beecrowd");

  return {
    success: true,
    message: `Beecrowd stats updated: ${solved} solved problems, rank: ${rank ? "#" + rank : "N/A"}.`,
  };
}

