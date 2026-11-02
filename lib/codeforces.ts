export type CodeforcesContestPoint = {
  contestId: number;
  contestName: string;
  contestDate: string; // e.g. "21 Jul 2023"
  dateIso: string; // "2023-07-21"
  rank: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
};

export type CodeforcesStats = {
  totalAllTime: number;
  totalLastYear: number;
  totalLastMonth: number;
  maxStreakAllTime: number;
  maxStreakLastYear: number;
  maxStreakLastMonth: number;
};

export type CodeforcesPublicProfile = {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  avatarUrl: string | null;
  contestHistory: CodeforcesContestPoint[];
  activityMap: Record<string, number>; // "YYYY-MM-DD" -> count
  stats: CodeforcesStats;
};

export function getCodeforcesColor(rating: number | null): string {
  if (rating == null || rating <= 0) return "#9e9e9e"; // Unrated / Gray
  if (rating < 1200) return "#9e9e9e"; // Newbie (Gray)
  if (rating < 1400) return "#22c55e"; // Pupil (Green)
  if (rating < 1600) return "#06b6d4"; // Specialist (Cyan)
  if (rating < 1900) return "#3b82f6"; // Expert (Blue)
  if (rating < 2200) return "#a855f7"; // Candidate Master (Purple)
  if (rating < 2400) return "#f97316"; // Master (Orange)
  return "#ef4444"; // Grandmaster (Red)
}

export function getCodeforcesRankTitle(rating: number | null): string {
  if (rating == null || rating <= 0) return "Unrated";
  if (rating < 1200) return "Newbie";
  if (rating < 1400) return "Pupil";
  if (rating < 1600) return "Specialist";
  if (rating < 1900) return "Expert";
  if (rating < 2200) return "Candidate Master";
  if (rating < 2400) return "Master";
  return "Grandmaster";
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
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

export function computeCodeforcesStreaks(
  activityMap: Record<string, number>,
  todayStr: string,
  totalAllTimeOverride?: number
): CodeforcesStats {
  const oneDayMs = 86400000;
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
  const oneYearAgoMs = todayMs - 365 * oneDayMs;
  const oneMonthAgoMs = todayMs - 30 * oneDayMs;

  let totalAllTime = 0;
  let totalLastYear = 0;
  let totalLastMonth = 0;

  const activeDates = new Set<string>();

  for (const [dStr, count] of Object.entries(activityMap)) {
    if (count > 0) {
      totalAllTime += count;
      activeDates.add(dStr);

      const ms = new Date(dStr + "T00:00:00Z").getTime();
      if (ms >= oneYearAgoMs && ms <= todayMs) {
        totalLastYear += count;
      }
      if (ms >= oneMonthAgoMs && ms <= todayMs) {
        totalLastMonth += count;
      }
    }
  }

  // If all-time total was passed (e.g. from total unique solved problems count)
  if (totalAllTimeOverride && totalAllTimeOverride > totalAllTime) {
    totalAllTime = totalAllTimeOverride;
  }

  // Compute streaks
  let maxStreakAllTime = 0;
  let maxStreakLastYear = 0;
  let maxStreakLastMonth = 0;
  let currentRun = 0;
  let currentRunLastYear = 0;
  let currentRunLastMonth = 0;

  const sortedDates = [...activeDates].sort();
  if (sortedDates.length > 0) {
    const firstMs = new Date(sortedDates[0] + "T00:00:00Z").getTime();
    let runner = firstMs;

    while (runner <= todayMs) {
      const dStr = new Date(runner).toISOString().slice(0, 10);
      const isActive = activeDates.has(dStr);

      if (isActive) {
        currentRun++;
        if (currentRun > maxStreakAllTime) maxStreakAllTime = currentRun;
      } else {
        currentRun = 0;
      }

      if (runner >= oneYearAgoMs) {
        if (isActive) {
          currentRunLastYear++;
          if (currentRunLastYear > maxStreakLastYear) maxStreakLastYear = currentRunLastYear;
        } else {
          currentRunLastYear = 0;
        }
      }

      if (runner >= oneMonthAgoMs) {
        if (isActive) {
          currentRunLastMonth++;
          if (currentRunLastMonth > maxStreakLastMonth) maxStreakLastMonth = currentRunLastMonth;
        } else {
          currentRunLastMonth = 0;
        }
      }

      runner += oneDayMs;
    }
  }

  return {
    totalAllTime,
    totalLastYear,
    totalLastMonth,
    maxStreakAllTime,
    maxStreakLastYear,
    maxStreakLastMonth,
  };
}

export async function getCodeforcesPublicDetails(
  handle: string,
  dbActivity: Array<{ activity_date: string; solved: number; rating: number | null }> = [],
  dbContests: Array<{ contest_name: string; contest_date: string; rank: number | null; rating_change: number | null }> = []
): Promise<CodeforcesPublicProfile> {
  const cleanHandle = handle.trim();
  const cfBase = process.env.CF_API_BASE ?? "https://codeforces.com/api";

  const now = new Date();
  const bdNow = new Date(now.getTime() + 6 * 3600000);
  const todayStr = bdNow.toISOString().slice(0, 10);

  let rating = 0;
  let maxRating = 0;
  let rank = "Unrated";
  let maxRank = "Unrated";
  let avatarUrl: string | null = null;
  let contestHistory: CodeforcesContestPoint[] = [];
  const activityMap: Record<string, number> = {};
  let totalSolvedAllTime = 0;

  // 1. Populate from local DB first as baseline
  for (const a of dbActivity) {
    activityMap[a.activity_date] = (activityMap[a.activity_date] ?? 0) + (a.solved || 0);
    if (a.rating != null && a.rating > rating) {
      rating = a.rating;
      maxRating = Math.max(maxRating, a.rating);
    }
  }

  // Baseline contest history from DB
  let cumulativeRating = 0;
  const sortedDbContests = [...dbContests].sort((a, b) => a.contest_date.localeCompare(b.contest_date));
  for (const c of sortedDbContests) {
    const change = c.rating_change || 0;
    const oldR = cumulativeRating;
    cumulativeRating += change;
    contestHistory.push({
      contestId: 0,
      contestName: c.contest_name,
      contestDate: formatDateShort(c.contest_date),
      dateIso: c.contest_date,
      rank: c.rank || 0,
      oldRating: oldR,
      newRating: cumulativeRating,
      ratingChange: change,
    });
  }
  if (cumulativeRating > 0) {
    rating = cumulativeRating;
    maxRating = Math.max(maxRating, cumulativeRating);
  }

  // 2. Try fetching live from Codeforces API (if available)
  try {
    const [infoRes, ratingRes, subsRes] = await Promise.all([
      fetch(`${cfBase}/user.info?handles=${encodeURIComponent(cleanHandle)}`, {
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
      fetch(`${cfBase}/user.rating?handle=${encodeURIComponent(cleanHandle)}`, {
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
      fetch(`${cfBase}/user.status?handle=${encodeURIComponent(cleanHandle)}&from=1&count=5000`, {
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
    ]);

    if (infoRes && infoRes.ok) {
      const infoData = await infoRes.json().catch(() => null);
      if (infoData?.status === "OK" && infoData.result?.[0]) {
        const u = infoData.result[0];
        rating = u.rating || rating;
        maxRating = u.maxRating || maxRating;
        rank = u.rank ? u.rank.charAt(0).toUpperCase() + u.rank.slice(1) : rank;
        maxRank = u.maxRank ? u.maxRank.charAt(0).toUpperCase() + u.maxRank.slice(1) : maxRank;
        avatarUrl = u.titlePhoto || avatarUrl;
      }
    }

    if (ratingRes && ratingRes.ok) {
      const rData = await ratingRes.json().catch(() => null);
      if (rData?.status === "OK" && Array.isArray(rData.result)) {
        contestHistory = rData.result.map(
          (c: {
            contestId: number;
            contestName: string;
            rank: number;
            oldRating: number;
            newRating: number;
            ratingUpdateTimeSeconds: number;
          }) => {
            const dateStr = new Date((c.ratingUpdateTimeSeconds + 6 * 3600) * 1000)
              .toISOString()
              .slice(0, 10);
            return {
              contestId: c.contestId,
              contestName: c.contestName,
              contestDate: formatDateShort(dateStr),
              dateIso: dateStr,
              rank: c.rank,
              oldRating: c.oldRating,
              newRating: c.newRating,
              ratingChange: c.newRating - c.oldRating,
            };
          }
        );
      }
    }

    if (subsRes && subsRes.ok) {
      const subsData = await subsRes.json().catch(() => null);
      if (subsData?.status === "OK" && Array.isArray(subsData.result)) {
        const firstAccepted = new Map<string, number>();
        for (const s of subsData.result) {
          if (s.verdict !== "OK" || !s.problem) continue;
          const key = `${s.problem.contestId ?? ""}-${s.problem.index}`;
          const prev = firstAccepted.get(key);
          if (prev === undefined || s.creationTimeSeconds < prev) {
            firstAccepted.set(key, s.creationTimeSeconds);
          }
        }
        totalSolvedAllTime = firstAccepted.size;
        for (const ts of firstAccepted.values()) {
          const d = new Date((ts + 6 * 3600) * 1000).toISOString().slice(0, 10);
          activityMap[d] = (activityMap[d] ?? 0) + 1;
        }
      }
    }
  } catch {
    // API unavailable or restricted; keep baseline
  }

  // If live submissions API was unavailable, derive total solved from dbActivity
  if (totalSolvedAllTime === 0 && Object.keys(activityMap).length > 0) {
    totalSolvedAllTime = Object.values(activityMap).reduce((a, b) => a + b, 0);
  }

  // Set rank title if still unset
  if (rank === "Unrated" && rating > 0) {
    rank = getCodeforcesRankTitle(rating);
    maxRank = getCodeforcesRankTitle(maxRating);
  }

  const stats = computeCodeforcesStreaks(activityMap, todayStr, totalSolvedAllTime);

  return {
    handle: cleanHandle,
    rating,
    maxRating,
    rank,
    maxRank,
    avatarUrl,
    contestHistory,
    activityMap,
    stats,
  };
}
