export type LeetCodeSubmissionStat = {
  difficulty: "All" | "Easy" | "Medium" | "Hard";
  count: number;
  submissions: number;
};

export type LeetCodeBadge = {
  id: string;
  displayName: string;
  icon: string;
  creationDate?: string;
};

export type LeetCodeContestPoint = {
  title: string;
  rating: number;
  ranking: number;
  problemsSolved: number;
  totalProblems: number;
  finishTimeInSeconds?: number;
  dateIso: string; // "YYYY-MM-DD"
  dateFormatted: string; // e.g. "22 Sep 2024"
  ratingChange: number;
  url?: string;
};

export type LeetCodeRecentSubmission = {
  title: string;
  titleSlug: string;
  timestamp: string; // e.g. "2024-09-22"
  statusDisplay: string; // e.g. "Accepted"
  lang: string;
};

export type LeetCodePublicProfile = {
  handle: string;
  realName: string | null;
  avatarUrl: string | null;
  ranking: number | null; // Global question rank
  reputation: number | null;
  country: string | null;
  company: string | null;
  school: string | null;
  skillTags: string[];
  aboutMe: string | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSubmissions: number;
  acceptanceRate: number;
  contestRating: number | null;
  contestGlobalRanking: number | null;
  contestAttended: number;
  totalParticipants: number | null;
  topPercentage: number | null;
  contestBadge: string | null; // "Guardian", "Knight", etc.
  badges: LeetCodeBadge[];
  contestHistory: LeetCodeContestPoint[];
  activityMap: Record<string, number>; // "YYYY-MM-DD" -> count
  streak: number;
  totalActiveDays: number;
  recentSubmissions: LeetCodeRecentSubmission[];
};

const monthsShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace(" ", "T") + (dateStr.includes("T") ? "" : "Z"));
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getUTCDate()} ${monthsShort[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function getLeetCodeBadgeColor(badgeName?: string | null): { bg: string; text: string; border: string } {
  const name = (badgeName || "").toLowerCase();
  if (name.includes("guardian")) {
    return {
      bg: "bg-amber-500/15 dark:bg-amber-500/20",
      text: "text-amber-600 dark:text-amber-400 font-bold",
      border: "border-amber-500/40",
    };
  }
  if (name.includes("knight")) {
    return {
      bg: "bg-purple-500/15 dark:bg-purple-500/20",
      text: "text-purple-600 dark:text-purple-400 font-bold",
      border: "border-purple-500/40",
    };
  }
  return {
    bg: "bg-blue-500/15 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400 font-semibold",
    border: "border-blue-500/30",
  };
}

const LEETCODE_GRAPHQL_QUERY = `
  query getLeetCodeUserData($username: String!) {
    matchedUser(username: $username) {
      username
      githubUrl
      twitterUrl
      linkedinUrl
      profile {
        realName
        userAvatar
        ranking
        reputation
        aboutMe
        countryName
        company
        school
        skillTags
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      badges {
        id
        displayName
        icon
        creationDate
      }
      userCalendar {
        activeYears
        streak
        totalActiveDays
        submissionCalendar
      }
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
      badge {
        name
      }
    }
    userContestRankingHistory(username: $username) {
      attended
      trendDirection
      problemsSolved
      totalProblems
      finishTimeInSeconds
      rating
      ranking
      contest {
        title
        startTime
      }
    }
    recentSubmissionList(username: $username, limit: 15) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

export async function getLeetCodePublicDetails(
  handle: string,
  dbActivity?: Array<{ activity_date: string; solved?: number | null; rating?: number | null }>,
  dbContests?: Array<{ contest_name: string; contest_date: string; rank?: number | null; rating_change?: number | null }>
): Promise<LeetCodePublicProfile | null> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) return null;

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: LEETCODE_GRAPHQL_QUERY,
        variables: { username: cleanHandle },
      }),
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`LeetCode GraphQL returned HTTP ${res.status} for ${cleanHandle}`);
      return createFallbackProfile(cleanHandle, dbActivity, dbContests);
    }

    const json = await res.json();
    const user = json?.data?.matchedUser;
    if (!user) {
      console.warn(`LeetCode user '${cleanHandle}' not found via GraphQL`);
      return createFallbackProfile(cleanHandle, dbActivity, dbContests);
    }

    const profileData = user.profile || {};
    const acStats: Array<{ difficulty: string; count: number; submissions: number }> =
      user.submitStatsGlobal?.acSubmissionNum || [];

    const allStat = acStats.find((s) => s.difficulty === "All") || { count: 0, submissions: 0 };
    const easyStat = acStats.find((s) => s.difficulty === "Easy") || { count: 0, submissions: 0 };
    const medStat = acStats.find((s) => s.difficulty === "Medium") || { count: 0, submissions: 0 };
    const hardStat = acStats.find((s) => s.difficulty === "Hard") || { count: 0, submissions: 0 };

    const totalSolved = allStat.count || 0;
    const totalSubmissions = allStat.submissions || 0;
    const acceptanceRate =
      totalSubmissions > 0
        ? Math.round((totalSolved / totalSubmissions) * 1000) / 10
        : 0;

    // Build Activity Map from userCalendar
    const activityMap: Record<string, number> = {};
    const calJsonStr = user.userCalendar?.submissionCalendar;
    if (calJsonStr) {
      try {
        const cal = JSON.parse(calJsonStr) as Record<string, number>;
        for (const [secStr, count] of Object.entries(cal)) {
          const sec = parseInt(secStr, 10);
          if (!isNaN(sec)) {
            // Adjust to UTC+6 date
            const d = new Date((sec + 6 * 3600) * 1000);
            const dateIso = d.toISOString().slice(0, 10);
            activityMap[dateIso] = (activityMap[dateIso] || 0) + Number(count);
          }
        }
      } catch (e) {
        console.warn("Failed to parse LeetCode submissionCalendar:", e);
      }
    }

    // Merge DB activity if live calendar is sparse
    if (dbActivity) {
      for (const a of dbActivity) {
        if (a.solved && a.solved > 0 && !activityMap[a.activity_date]) {
          activityMap[a.activity_date] = a.solved;
        }
      }
    }

    // Contest Ranking & History
    const contestRanking = json?.data?.userContestRanking;
    const rawHistory = (json?.data?.userContestRankingHistory || []) as Array<{
      attended: boolean;
      rating: number;
      ranking: number;
      problemsSolved: number;
      totalProblems: number;
      finishTimeInSeconds?: number;
      contest: { title: string; startTime: number };
    }>;

    // Filter attended contests and sort ascending by date
    const attendedHistory = rawHistory
      .filter((h) => h.attended && h.contest?.title)
      .sort((a, b) => (a.contest.startTime || 0) - (b.contest.startTime || 0));

    const contestPoints: LeetCodeContestPoint[] = [];
    let prevRating = 1500; // LeetCode baseline starting rating

    for (const h of attendedHistory) {
      const d = new Date(((h.contest.startTime || 0) + 6 * 3600) * 1000);
      const dateIso = d.toISOString().slice(0, 10);
      const currentRating = Math.round(h.rating);
      const ratingChange = currentRating - prevRating;
      prevRating = currentRating;

      contestPoints.push({
        title: h.contest.title,
        rating: currentRating,
        ranking: h.ranking,
        problemsSolved: h.problemsSolved,
        totalProblems: h.totalProblems,
        finishTimeInSeconds: h.finishTimeInSeconds,
        dateIso,
        dateFormatted: formatDateShort(dateIso),
        ratingChange,
        url: `https://leetcode.com/contest/${h.contest.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      });
    }

    // Merge DB contests if live contest history is empty
    if (contestPoints.length === 0 && dbContests && dbContests.length > 0) {
      for (const dc of dbContests) {
        contestPoints.push({
          title: dc.contest_name,
          rating: 0,
          ranking: dc.rank || 0,
          problemsSolved: 0,
          totalProblems: 4,
          dateIso: dc.contest_date,
          dateFormatted: formatDateShort(dc.contest_date),
          ratingChange: dc.rating_change || 0,
        });
      }
    }

    // Badges
    const badges: LeetCodeBadge[] = (user.badges || []).map((b: { id?: string; displayName?: string; icon?: string; creationDate?: string }) => {
      let icon = b.icon || "";
      if (icon.startsWith("/")) {
        icon = `https://leetcode.com${icon}`;
      }
      return {
        id: b.id || b.displayName || "",
        displayName: b.displayName || "LeetCode Badge",
        icon,
        creationDate: b.creationDate,
      };
    });

    // Recent Submissions
    const rawSubs = (json?.data?.recentSubmissionList || []) as Array<{
      title: string;
      titleSlug: string;
      timestamp: string;
      statusDisplay: string;
      lang: string;
    }>;

    const recentSubmissions: LeetCodeRecentSubmission[] = rawSubs.map((s) => {
      const sec = parseInt(s.timestamp, 10);
      const dateStr = !isNaN(sec) ? new Date(sec * 1000).toISOString().slice(0, 10) : "";
      return {
        title: s.title,
        titleSlug: s.titleSlug,
        timestamp: dateStr,
        statusDisplay: s.statusDisplay,
        lang: s.lang,
      };
    });

    return {
      handle: cleanHandle,
      realName: profileData.realName || null,
      avatarUrl: profileData.userAvatar || null,
      ranking: profileData.ranking ? Number(profileData.ranking) : null,
      reputation: profileData.reputation ? Number(profileData.reputation) : null,
      country: profileData.countryName || null,
      company: profileData.company || null,
      school: profileData.school || null,
      skillTags: Array.isArray(profileData.skillTags) ? profileData.skillTags : [],
      aboutMe: profileData.aboutMe || null,
      totalSolved,
      easySolved: easyStat.count || 0,
      mediumSolved: medStat.count || 0,
      hardSolved: hardStat.count || 0,
      totalSubmissions,
      acceptanceRate,
      contestRating: contestRanking?.rating ? Math.round(contestRanking.rating) : null,
      contestGlobalRanking: contestRanking?.globalRanking ? Number(contestRanking.globalRanking) : null,
      contestAttended: contestRanking?.attendedContestsCount ? Number(contestRanking.attendedContestsCount) : contestPoints.length,
      totalParticipants: contestRanking?.totalParticipants ? Number(contestRanking.totalParticipants) : null,
      topPercentage: contestRanking?.topPercentage ? Number(contestRanking.topPercentage) : null,
      contestBadge: contestRanking?.badge?.name || null,
      badges,
      contestHistory: contestPoints,
      activityMap,
      streak: user.userCalendar?.streak || 0,
      totalActiveDays: user.userCalendar?.totalActiveDays || Object.keys(activityMap).length,
      recentSubmissions,
    };
  } catch (err: unknown) {
    console.error(`Error fetching LeetCode details for ${cleanHandle}:`, err);
    return createFallbackProfile(cleanHandle, dbActivity, dbContests);
  }
}

function createFallbackProfile(
  handle: string,
  dbActivity?: Array<{ activity_date: string; solved?: number | null; rating?: number | null }>,
  dbContests?: Array<{ contest_name: string; contest_date: string; rank?: number | null; rating_change?: number | null }>
): LeetCodePublicProfile {
  const activityMap: Record<string, number> = {};
  let totalSolved = 0;
  let currentRating: number | null = null;

  if (dbActivity) {
    for (const a of dbActivity) {
      if (a.solved) {
        activityMap[a.activity_date] = a.solved;
        totalSolved += a.solved;
      }
      if (a.rating != null) {
        currentRating = a.rating;
      }
    }
  }

  const contestHistory: LeetCodeContestPoint[] = (dbContests || []).map((c) => ({
    title: c.contest_name,
    rating: 0,
    ranking: c.rank || 0,
    problemsSolved: 0,
    totalProblems: 4,
    dateIso: c.contest_date,
    dateFormatted: formatDateShort(c.contest_date),
    ratingChange: c.rating_change || 0,
  }));

  return {
    handle,
    realName: null,
    avatarUrl: null,
    ranking: null,
    reputation: null,
    country: null,
    company: null,
    school: null,
    skillTags: [],
    aboutMe: null,
    totalSolved,
    easySolved: Math.round(totalSolved * 0.4),
    mediumSolved: Math.round(totalSolved * 0.45),
    hardSolved: Math.round(totalSolved * 0.15),
    totalSubmissions: totalSolved,
    acceptanceRate: 65,
    contestRating: currentRating,
    contestGlobalRanking: null,
    contestAttended: contestHistory.length,
    totalParticipants: null,
    topPercentage: null,
    contestBadge: null,
    badges: [],
    contestHistory,
    activityMap,
    streak: 0,
    totalActiveDays: Object.keys(activityMap).length,
    recentSubmissions: [],
  };
}
