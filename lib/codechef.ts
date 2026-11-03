export type CodeChefContestPoint = {
  code: string;
  name: string;
  rating: number;
  rank: number;
  dateIso: string; // "YYYY-MM-DD"
  dateFormatted: string; // e.g. "8 Feb 2023"
  color: string;
  ratingChange: number;
};

export type CodeChefBadge = {
  icon: string;
  name: string;
};

export type CodeChefStats = {
  totalAllTime: number;
  totalLastYear: number;
  totalLastMonth: number;
  maxStreakAllTime: number;
  maxStreakLastYear: number;
  maxStreakLastMonth: number;
};

export type CodeChefPublicProfile = {
  handle: string;
  name: string | null;
  avatarUrl: string | null;
  stars: string | null; // e.g. "1★", "6★", "7★"
  starColor: string; // e.g. "#D0011B", "#FF7F00"
  rating: number | null;
  highestRating: number | null;
  division: string | null; // e.g. "Div 1", "Div 2", "Div 3", "Div 4"
  globalRank: number | null;
  globalRankText: string | null; // e.g. "#1" or "Inactive"
  countryRank: number | null;
  countryRankText: string | null; // e.g. "#1" or "Inactive"
  country: string | null;
  institution: string | null;
  totalSolved: number;
  badges: CodeChefBadge[];
  contestHistory: CodeChefContestPoint[];
  activityMap: Record<string, number>; // "YYYY-MM-DD" -> count
  stats: CodeChefStats;
};

/**
 * Returns authentic CodeChef rating star color & star title based on rating or star text.
 * CodeChef official division & rating tiers:
 * 1★: 0 - 1399    (#666666 / Gray)
 * 2★: 1400 - 1599 (#1E7D22 / Green)
 * 3★: 1600 - 1799 (#3366CB / Blue)
 * 4★: 1800 - 1999 (#684273 / Purple)
 * 5★: 2000 - 2199 (#FFBF00 / Yellow)
 * 6★: 2200 - 2499 (#FF7F00 / Orange)
 * 7★: 2500+       (#D0011B / Red)
 */
export function getCodeChefStarInfo(rating: number | null, starsStr?: string | null): { stars: string; color: string; div: string } {
  if (rating != null && rating > 0) {
    if (rating >= 2500) return { stars: "7★", color: "#D0011B", div: "Div 1" };
    if (rating >= 2200) return { stars: "6★", color: "#FF7F00", div: "Div 1" };
    if (rating >= 2000) return { stars: "5★", color: "#FFBF00", div: "Div 2" };
    if (rating >= 1800) return { stars: "4★", color: "#684273", div: "Div 2" };
    if (rating >= 1600) return { stars: "3★", color: "#3366CB", div: "Div 3" };
    if (rating >= 1400) return { stars: "2★", color: "#1E7D22", div: "Div 3" };
    return { stars: "1★", color: "#666666", div: "Div 4" };
  }

  if (starsStr) {
    const num = parseInt(starsStr.replace(/\D/g, ""), 10);
    switch (num) {
      case 7: return { stars: "7★", color: "#D0011B", div: "Div 1" };
      case 6: return { stars: "6★", color: "#FF7F00", div: "Div 1" };
      case 5: return { stars: "5★", color: "#FFBF00", div: "Div 2" };
      case 4: return { stars: "4★", color: "#684273", div: "Div 2" };
      case 3: return { stars: "3★", color: "#3366CB", div: "Div 3" };
      case 2: return { stars: "2★", color: "#1E7D22", div: "Div 3" };
      default: return { stars: "1★", color: "#666666", div: "Div 4" };
    }
  }

  return { stars: "1★", color: "#666666", div: "Div 4" };
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace(" ", "T") + (dateStr.includes("T") ? "" : "Z"));
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getUTCDate();
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function computeCodeChefStreaks(
  activityMap: Record<string, number>,
  todayStr: string,
  totalAllTimeOverride?: number
): CodeChefStats {
  const oneDayMs = 86400000;
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
  const oneYearAgoMs = todayMs - 365 * oneDayMs;
  const oneMonthAgoMs = todayMs - 30 * oneDayMs;

  let totalAllTime = 0;
  let totalLastYear = 0;
  let totalLastMonth = 0;

  const activeDates = new Set<string>();

  for (const [dStr, count] of Object.entries(activityMap)) {
    totalAllTime += count;
    const ms = new Date(dStr + "T00:00:00Z").getTime();
    if (ms >= oneYearAgoMs && ms <= todayMs) {
      totalLastYear += count;
    }
    if (ms >= oneMonthAgoMs && ms <= todayMs) {
      totalLastMonth += count;
    }
    if (count > 0) {
      activeDates.add(dStr);
    }
  }

  if (totalAllTimeOverride !== undefined && totalAllTimeOverride > totalAllTime) {
    totalAllTime = totalAllTimeOverride;
  }

  const sortedDates = [...activeDates].sort();

  function calcMaxStreak(fromMs: number, toMs: number): number {
    let maxS = 0;
    let curS = 0;
    let prevMs = -1;

    for (const dStr of sortedDates) {
      const ms = new Date(dStr + "T00:00:00Z").getTime();
      if (ms < fromMs || ms > toMs) continue;

      if (prevMs === -1) {
        curS = 1;
      } else {
        const diffDays = Math.round((ms - prevMs) / oneDayMs);
        if (diffDays === 1) {
          curS += 1;
        } else if (diffDays > 1) {
          curS = 1;
        }
      }
      prevMs = ms;
      if (curS > maxS) maxS = curS;
    }
    return maxS;
  }

  const maxStreakAllTime = calcMaxStreak(0, todayMs);
  const maxStreakLastYear = calcMaxStreak(oneYearAgoMs, todayMs);
  const maxStreakLastMonth = calcMaxStreak(oneMonthAgoMs, todayMs);

  return {
    totalAllTime,
    totalLastYear,
    totalLastMonth,
    maxStreakAllTime,
    maxStreakLastYear,
    maxStreakLastMonth,
  };
}

/**
 * Fetches and parses a public CodeChef profile page.
 */
export async function getCodeChefPublicDetails(
  handle: string,
  dbActivity: Array<{ activity_date: string; solved: number; rating: number | null }> = [],
  dbContests: Array<{
    contest_name: string;
    contest_date: string;
    rank: number | null;
    rating_change: number | null;
  }> = []
): Promise<CodeChefPublicProfile | null> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) return null;

  const now = new Date();
  const bdNow = new Date(now.getTime() + 6 * 3600000);
  const todayStr = bdNow.toISOString().slice(0, 10);

  const activityMap: Record<string, number> = {};
  for (const act of dbActivity) {
    if (act.solved > 0) {
      activityMap[act.activity_date] = (activityMap[act.activity_date] || 0) + act.solved;
    }
  }

  let html = "";
  const profileUrl = `https://www.codechef.com/users/${encodeURIComponent(cleanHandle)}`;

  try {
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (res.ok) {
      html = await res.text();
    }
  } catch {
    // If standard fetch failed or timed out, attempt Firecrawl fallback if configured
  }

  // Cloudflare fallback via Firecrawl if needed
  if (
    (!html ||
      html.includes("cf-browser-verification") ||
      html.includes("Just a moment...") ||
      html.includes("challenge-platform")) &&
    process.env.FIRECRAWL_API_KEY
  ) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: profileUrl,
          formats: ["rawHtml", "html"],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (fcRes.ok) {
        const fcData = await fcRes.json().catch(() => null);
        html = fcData?.data?.rawHtml || fcData?.data?.html || "";
      }
    } catch {
      // Firecrawl failed or timed out
    }
  }

  if (!html || html.includes("<title>Page not found") || html.includes("User not found")) {
    if (dbActivity.length === 0 && dbContests.length === 0) {
      return null;
    }
  }

  // 1. Current Rating
  const ratingMatch = html.match(/<div class="rating-number">([^<]+)<\/div>/i);
  let parsedRating: number | null = null;
  if (ratingMatch) {
    const rRaw = ratingMatch[1].trim();
    if (/^\d+$/.test(rRaw)) {
      parsedRating = parseInt(rRaw, 10);
    }
  }
  if (parsedRating == null) {
    const latestDbRating = dbActivity.find((a) => a.rating != null)?.rating;
    if (latestDbRating != null) parsedRating = latestDbRating;
  }

  // 2. Stars
  const starsMatch = html.match(/<span[^>]*class=['"]rating['"][^>]*>(\d+)(?:&#9733;|★)<\/span>/i);
  let starsStr: string | null = starsMatch ? `${starsMatch[1]}★` : null;
  if (!starsStr) {
    const starCount = (html.match(/<div class="rating-star">([\s\S]*?)<\/div>/i)?.[1]?.match(/&#9733;/g) || []).length;
    if (starCount > 0) starsStr = `${starCount}★`;
  }

  // 3. Division
  const divMatch = html.match(/\((Div\s*\d+)\)/i);
  let division: string | null = divMatch ? divMatch[1].replace(/\s+/, " ") : null;

  const starInfo = getCodeChefStarInfo(parsedRating, starsStr);
  const finalStars = starsStr || (parsedRating ? starInfo.stars : null);
  const finalStarColor = starInfo.color;
  if (!division && parsedRating) {
    division = starInfo.div;
  }

  // 4. Highest Rating
  const highestMatch =
    html.match(/Highest Rating\s*<small>(\d+)<\/small>/i) ||
    html.match(/\(Highest Rating\s*(\d+)\)/i) ||
    html.match(/Highest Rating\s*(\d+)/i);
  let highestRating: number | null = highestMatch ? parseInt(highestMatch[1], 10) : null;
  if (highestRating == null && parsedRating != null) {
    highestRating = parsedRating;
  }

  // 5. Global & Country Ranks
  const ranksBlock = html.match(/<div class="rating-ranks">[\s\S]*?<\/div>/i)?.[0];
  const globalRankRaw = ranksBlock?.match(/<a href="\/ratings\/all">\s*<strong>\s*([^<]+)\s*<\/strong>/i)?.[1]?.trim();
  const countryRankRaw = ranksBlock?.match(/<a href="\/ratings\/all\?filterBy=Country[^\"]*">\s*<strong>\s*([^<]+)\s*<\/strong>/i)?.[1]?.trim();

  let globalRank: number | null = null;
  let globalRankText: string | null = null;
  if (globalRankRaw) {
    const cleanR = globalRankRaw.replace(/,/g, "");
    if (/^\d+$/.test(cleanR)) {
      globalRank = parseInt(cleanR, 10);
      globalRankText = `#${globalRank.toLocaleString()}`;
    } else {
      globalRankText = globalRankRaw;
    }
  }

  let countryRank: number | null = null;
  let countryRankText: string | null = null;
  if (countryRankRaw) {
    const cleanR = countryRankRaw.replace(/,/g, "");
    if (/^\d+$/.test(cleanR)) {
      countryRank = parseInt(cleanR, 10);
      countryRankText = `#${countryRank.toLocaleString()}`;
    } else {
      countryRankText = countryRankRaw;
    }
  }

  // 6. Total Problems Solved
  const solvedMatch = html.match(/Total Problems Solved:\s*(\d+)/i);
  const dbSolvedSum = dbActivity.reduce((acc, a) => acc + (a.solved || 0), 0);
  const totalSolved = solvedMatch ? parseInt(solvedMatch[1], 10) : dbSolvedSum;

  // 7. Full Name, Country, Institution, Avatar
  const nameMatch = html.match(/<h1 class="h2-style"[^>]*>([^<]+)<\/h1>/i);
  const name = nameMatch ? nameMatch[1].trim() : null;

  const countryMatch = html.match(/<span class="user-country-name"[^>]*>([^<]+)<\/span>/i);
  const country = countryMatch ? countryMatch[1].trim() : null;

  const institutionMatch =
    html.match(/Institution:[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/Student\/Professional:[\s\S]*?<span>([^<]+)<\/span>/i);
  const institution = institutionMatch ? institutionMatch[1].trim() : null;

  const avatarMatch = html.match(/<img class=['"]profileImage['"][^>]*src=['"]([^'"]+)['"]/i);
  let avatarUrl: string | null = null;
  if (avatarMatch && !avatarMatch[1].includes("user_default_thumb.jpg") && !avatarMatch[1].includes("ajax-loader.gif")) {
    avatarUrl = avatarMatch[1];
  }

  // 8. Badges
  const badges: CodeChefBadge[] = [];
  const badgeMatches = [...html.matchAll(/<img[^>]+src=['"](https:\/\/cdn\.codechef\.com\/images\/badges\/[^'"]+)['"][^>]*alt=['"]([^'"]+)['"]/gi)];
  for (const m of badgeMatches) {
    badges.push({
      icon: m[1],
      name: m[2].trim(),
    });
  }

  // 9. Contest History (var all_rating = [...])
  const contestPoints: CodeChefContestPoint[] = [];
  const contestScriptMatch = html.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
  if (contestScriptMatch) {
    try {
      type RawContest = {
        code: string;
        name: string;
        rating: string | number;
        rank: string | number;
        end_date: string;
        color?: string;
      };
      const rawContests: RawContest[] = JSON.parse(contestScriptMatch[1]);
      let prevRating = 0;

      for (let i = 0; i < rawContests.length; i++) {
        const c = rawContests[i];
        const rNum = typeof c.rating === "number" ? c.rating : parseInt(String(c.rating), 10) || 0;
        const rankNum = typeof c.rank === "number" ? c.rank : parseInt(String(c.rank), 10) || 0;
        const dateIso = (c.end_date || "").slice(0, 10);
        const change = i === 0 ? 0 : rNum - prevRating;
        prevRating = rNum;

        contestPoints.push({
          code: c.code || `CONTEST_${i + 1}`,
          name: c.name || c.code || "CodeChef Contest",
          rating: rNum,
          rank: rankNum,
          dateIso,
          dateFormatted: formatDateShort(c.end_date || dateIso),
          color: c.color || getCodeChefStarInfo(rNum).color,
          ratingChange: change,
        });
      }
    } catch {
      // JSON parse fallback
    }
  }

  // If page had no contest history script, reconstruct from dbContests
  if (contestPoints.length === 0 && dbContests.length > 0) {
    let runningRating = 1500;
    const sortedDb = [...dbContests].sort((a, b) => a.contest_date.localeCompare(b.contest_date));
    for (const c of sortedDb) {
      const change = c.rating_change || 0;
      runningRating += change;
      contestPoints.push({
        code: c.contest_name.slice(0, 20),
        name: c.contest_name,
        rating: runningRating,
        rank: c.rank || 0,
        dateIso: c.contest_date,
        dateFormatted: formatDateShort(c.contest_date),
        color: getCodeChefStarInfo(runningRating).color,
        ratingChange: change,
      });
    }
  }

  // 10. Submissions Heatmap (var userDailySubmissionsStats = [...])
  const heatMatch = html.match(/var\s+userDailySubmissionsStats\s*=\s*(\[[\s\S]*?\]);/);
  if (heatMatch) {
    try {
      type HeatItem = { date: string; value: number };
      const rawHeat: HeatItem[] = JSON.parse(heatMatch[1]);
      for (const item of rawHeat) {
        if (item.date && item.value > 0) {
          activityMap[item.date] = (activityMap[item.date] || 0) + item.value;
        }
      }
    } catch {
      // Heatmap JSON parse fallback
    }
  }

  const stats = computeCodeChefStreaks(activityMap, todayStr, totalSolved);

  return {
    handle: cleanHandle,
    name,
    avatarUrl,
    stars: finalStars,
    starColor: finalStarColor,
    rating: parsedRating,
    highestRating,
    division,
    globalRank,
    globalRankText,
    countryRank,
    countryRankText,
    country,
    institution,
    totalSolved,
    badges,
    contestHistory: contestPoints,
    activityMap,
    stats,
  };
}

