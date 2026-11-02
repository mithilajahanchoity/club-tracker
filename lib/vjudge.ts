export type VJudgePublicProfile = {
  handle: string;
  name: string;
  avatarUrl: string | null;
  rank: string;
  solvedCount: number;
  attemptedCount: number;
  ac1d: number;
  ac7d: number;
  ac30d: number;
  registerTime: string;
  lastSeen: string;
  school: string;
  email: string | null;
  yearlyCounts: Record<string, number>;
  activityMap: Record<string, number>;
};

export async function getVJudgePublicDetails(
  handle: string,
  memberEmail?: string | null,
  dbSolved = 0,
  dbRank: number | null = null
): Promise<VJudgePublicProfile> {
  const cleanHandle = handle.trim();
  const vjudgeBase = process.env.VJUDGE_BASE_URL ?? "https://vjudge.net";

  let name = cleanHandle;
  let avatarUrl: string | null = null;
  let rank = dbRank != null ? `#${dbRank}` : "UNRANKED";
  let solvedCount = dbSolved;
  let attemptedCount = dbSolved;
  let ac1d = 0;
  let ac7d = 0;
  let ac30d = 0;
  let registerTime = "—";
  let lastSeen = "—";
  let school = "—";
  const email = memberEmail || null;
  const yearlyCounts: Record<string, number> = {};
  const activityMap: Record<string, number> = {};

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    const [profileRes, statsRes] = await Promise.all([
      fetch(`${vjudgeBase}/user/${encodeURIComponent(cleanHandle)}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      }).catch(() => null),
      fetch(`${vjudgeBase}/user/dailySolveStat/${encodeURIComponent(cleanHandle)}`, {
        headers: {
          ...headers,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null),
    ]);

    if (profileRes && profileRes.ok) {
      const html = await profileRes.text();

      // 1. JSON Profile Header Data
      const headerMatch = html.match(/id="profile-header-data">([\s\S]*?)<\/script>/i);
      if (headerMatch) {
        try {
          const parsed = JSON.parse(headerMatch[1]);
          if (parsed.counts) {
            if (typeof parsed.counts.acAll === "number") solvedCount = parsed.counts.acAll;
            if (typeof parsed.counts.attAll === "number") attemptedCount = parsed.counts.attAll;
            if (typeof parsed.counts.ac1d === "number") ac1d = parsed.counts.ac1d;
            if (typeof parsed.counts.ac7d === "number") ac7d = parsed.counts.ac7d;
            if (typeof parsed.counts.ac30d === "number") ac30d = parsed.counts.ac30d;
          }
          if (parsed.ranks && typeof parsed.ranks.all === "number") {
            rank = `#${parsed.ranks.all.toLocaleString()}`;
          }
        } catch {
          // Ignore JSON parse error
        }
      }

      // 2. Avatar
      const avatarMatch =
        html.match(/<img[^>]*id="user_avatar"[^>]*src="([^"]+)"/i) ||
        html.match(/src="(\/user\/avatar\/[^"]+)"/i);
      if (avatarMatch) {
        avatarUrl = avatarMatch[1].startsWith("http")
          ? avatarMatch[1]
          : `${vjudgeBase}${avatarMatch[1]}`;
      }

      // 3. Name
      const nameMatch = html.match(/class="profile-meta"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i);
      if (nameMatch && nameMatch[1].trim()) {
        name = nameMatch[1].trim();
      }

      // 4. Registration Date
      const regMatch = html.match(/data-i18n="user\.profile\.register"[^>]*>[^<]*<\/dt>\s*<dd>([^<]+)<\/dd>/i);
      if (regMatch) registerTime = regMatch[1].trim();

      // 5. Last Seen
      const seenMatch = html.match(/data-i18n="user\.profile\.last_seen"[^>]*>[^<]*<\/dt>\s*<dd>([^<]+)<\/dd>/i);
      if (seenMatch) lastSeen = seenMatch[1].trim();

      // 6. School
      const schoolMatch = html.match(/data-i18n="user\.profile\.school"[^>]*>[^<]*<\/dt>\s*<dd>([^<]+)<\/dd>/i);
      if (schoolMatch) school = schoolMatch[1].trim();
    }

    if (statsRes && statsRes.ok) {
      const statsData = await statsRes.json().catch(() => null);
      if (Array.isArray(statsData)) {
        for (const entry of statsData) {
          if (Array.isArray(entry) && entry[0] > 0) {
            const firstAcSec = entry[0];
            const dateStr = new Date((firstAcSec + 6 * 3600) * 1000).toISOString().slice(0, 10);
            const yr = dateStr.slice(0, 4);
            yearlyCounts[yr] = (yearlyCounts[yr] ?? 0) + 1;
            activityMap[dateStr] = (activityMap[dateStr] ?? 0) + 1;
          }
        }
      }
    }
  } catch {
    // API unavailable or network restricted; keep baseline
  }

  return {
    handle: cleanHandle,
    name,
    avatarUrl,
    rank,
    solvedCount,
    attemptedCount,
    ac1d,
    ac7d,
    ac30d,
    registerTime,
    lastSeen,
    school,
    email,
    yearlyCounts,
    activityMap,
  };
}

