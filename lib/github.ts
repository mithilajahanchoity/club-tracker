export type GitHubRepo = {
  name: string;
  description: string | null;
  htmlUrl: string;
  isPrivate: boolean;
  language: string | null;
  languageColor: string;
  updatedAt: string;
  stargazersCount: number;
  forksCount: number;
};

export type GitHubPublicProfile = {
  handle: string;
  avatarUrl: string | null;
  totalContributionsLastYear: number;
  yearlyContributions: Record<string, number>;
  activityMap: Record<string, number>; // "YYYY-MM-DD" -> count
  publicRepos: GitHubRepo[];
  isActivityPublic: boolean;
};

export const GITHUB_LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  PHP: "#4F5D95",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Java: "#b07219",
  CSS: "#563d7c",
  Ruby: "#701516",
  Go: "#00ADD8",
  Rust: "#dea584",
  Dart: "#00B4AB",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Shell: "#89e051",
  Tcl: "#e4cc98",
  Assembly: "#6E4C13",
  Vue: "#41b883",
  SCSS: "#c6538c",
};

export function formatGitHubUpdateDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 24 && now.getUTCDate() === d.getUTCDate()) {
      return "Updated today";
    }
    if (diffHours < 48) {
      return "Updated yesterday";
    }

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const month = months[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();

    if (year === now.getUTCFullYear()) {
      return `Updated on ${month} ${day}`;
    }
    return `Updated on ${month} ${day}, ${year}`;
  } catch {
    return "Updated recently";
  }
}

export async function getGitHubPublicDetails(
  handle: string,
  dbActivity: Array<{ activity_date: string; commits: number }> = []
): Promise<GitHubPublicProfile> {
  const cleanHandle = handle.trim();
  const token = process.env.GH_SYNC_TOKEN;

  let avatarUrl: string | null = `https://github.com/${cleanHandle}.png`;
  let publicRepos: GitHubRepo[] = [];
  const activityMap: Record<string, number> = {};
  const yearlyContributions: Record<string, number> = {};
  let totalContributionsLastYear = 0;
  let isActivityPublic = false;
  let activityExplicitlyHidden = false;

  // 1. Populate activity from local DB
  for (const a of dbActivity) {
    if (a.commits > 0) {
      activityMap[a.activity_date] = (activityMap[a.activity_date] ?? 0) + a.commits;
      const yr = a.activity_date.slice(0, 4);
      yearlyContributions[yr] = (yearlyContributions[yr] ?? 0) + a.commits;
      isActivityPublic = true;
    }
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "club-tracker",
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. Fetch public profile and public repositories via GitHub REST API
    const [reposRes, userRes, contribRes] = await Promise.all([
      fetch(
        `https://api.github.com/users/${encodeURIComponent(cleanHandle)}/repos?type=public&sort=updated&per_page=30`,
        { headers, signal: AbortSignal.timeout(8000) }
      ).catch(() => null),
      fetch(
        `https://api.github.com/users/${encodeURIComponent(cleanHandle)}`,
        { headers, signal: AbortSignal.timeout(8000) }
      ).catch(() => null),
      fetch(
        `https://github.com/users/${encodeURIComponent(cleanHandle)}/contributions`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        }
      ).catch(() => null),
    ]);

    if (userRes && userRes.ok) {
      const userData = await userRes.json().catch(() => null);
      if (userData?.avatar_url) {
        avatarUrl = userData.avatar_url;
      }
    }

    if (reposRes && reposRes.ok) {
      const reposData = await reposRes.json().catch(() => null);
      if (Array.isArray(reposData)) {
        publicRepos = reposData
          .filter((r: { private?: boolean }) => !r.private)
          .map((r: {
            name: string;
            description?: string | null;
            html_url: string;
            private?: boolean;
            language?: string | null;
            updated_at: string;
            stargazers_count?: number;
            forks_count?: number;
          }) => {
            const lang = r.language || null;
            const langColor = lang ? GITHUB_LANG_COLORS[lang] || "#8b949e" : "#8b949e";
            return {
              name: r.name,
              description: r.description || null,
              htmlUrl: r.html_url,
              isPrivate: Boolean(r.private),
              language: lang,
              languageColor: langColor,
              updatedAt: formatGitHubUpdateDate(r.updated_at),
              stargazersCount: r.stargazers_count || 0,
              forksCount: r.forks_count || 0,
            };
          });
      }
    }

    // 3. Inspect public contributions HTML endpoint
    if (contribRes && contribRes.ok) {
      const html = await contribRes.text();
      const hasCalendar = html.includes("js-calendar-graph");
      const isPrivateMentioned =
        html.includes("activity is private") ||
        html.includes("activity is hidden") ||
        html.includes("profile is private");

      if (hasCalendar && !isPrivateMentioned) {
        isActivityPublic = true;
        activityExplicitlyHidden = false;

        const descMatch = html.match(
          /id="js-contribution-activity-description"[^>]*>([\s\S]*?)<\/h2>/i
        );
        if (descMatch) {
          const numMatch = descMatch[1].replace(/,/g, "").match(/(\d+)\s+contributions?/i);
          if (numMatch) {
            totalContributionsLastYear = parseInt(numMatch[1], 10);
          }
        }

        const dayMatches = [...html.matchAll(/data-date="([^"]+)"[^>]*data-level="(\d+)"/g)];
        for (const m of dayMatches) {
          const dateStr = m[1];
          const level = Number(m[2]);
          if (level > 0) {
            activityMap[dateStr] = Math.max(activityMap[dateStr] ?? 0, level);
            const yr = dateStr.slice(0, 4);
            yearlyContributions[yr] = (yearlyContributions[yr] ?? 0) + level;
          }
        }
      } else {
        isActivityPublic = false;
        activityExplicitlyHidden = true;
      }
    } else if (contribRes && (contribRes.status === 404 || contribRes.status === 403)) {
      isActivityPublic = false;
      activityExplicitlyHidden = true;
    }

    // 4. If token is available, refine with GraphQL
    if (token) {
      const from = new Date(Date.now() - 365 * 86400000).toISOString();
      const to = new Date().toISOString();
      const ghQuery = `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              hasAnyContributions
              hasAnyRestrictedContributions
              restrictedContributionsCount
              contributionYears
              contributionCalendar {
                totalContributions
                weeks { contributionDays { date contributionCount } }
              }
            }
          }
        }
      `;
      const gqlRes = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "club-tracker",
        },
        body: JSON.stringify({
          query: ghQuery,
          variables: { login: cleanHandle, from, to },
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (gqlRes && gqlRes.ok) {
        const gqlData = await gqlRes.json().catch(() => null);
        const col = gqlData?.data?.user?.contributionsCollection;
        const cal = col?.contributionCalendar;

        if (Array.isArray(col?.contributionYears)) {
          for (const yr of col.contributionYears) {
            if (yearlyContributions[String(yr)] === undefined) {
              yearlyContributions[String(yr)] = 0;
            }
          }
        }

        if (cal?.weeks) {
          const days: Array<{ date: string; contributionCount: number }> =
            cal.weeks.flatMap((w: { contributionDays: Array<{ date: string; contributionCount: number }> }) => w.contributionDays);

          const hasRealDays = days.some((d) => d.contributionCount > 0);
          const totalCalContribs = typeof cal.totalContributions === "number" ? cal.totalContributions : 0;

          if (!activityExplicitlyHidden && (isActivityPublic || col?.hasAnyContributions || hasRealDays || totalCalContribs > 0)) {
            isActivityPublic = true;
            if (typeof cal.totalContributions === "number") {
              totalContributionsLastYear = cal.totalContributions;
            }
            for (const d of days) {
              if (d.contributionCount > 0) {
                activityMap[d.date] = d.contributionCount;
                const yr = d.date.slice(0, 4);
                yearlyContributions[yr] = (yearlyContributions[yr] ?? 0) + d.contributionCount;
              }
            }
          }
        }
      }
    }
  } catch {
    // API unavailable or network restricted
  }

  // 5. Calculate total contributions for the last 365 days if not set from GraphQL/HTML
  if (totalContributionsLastYear === 0 && Object.keys(activityMap).length > 0) {
    const nowMs = Date.now();
    const oneYearAgoMs = nowMs - 365 * 86400000;
    for (const [dStr, cnt] of Object.entries(activityMap)) {
      const ms = new Date(dStr + "T00:00:00Z").getTime();
      if (ms >= oneYearAgoMs && ms <= nowMs) {
        totalContributionsLastYear += cnt;
      }
    }
  }

  // If activity is explicitly hidden by GitHub privacy settings, keep isActivityPublic false.
  // Otherwise, if there are real contributions recorded, activity is public.
  if (activityExplicitlyHidden) {
    isActivityPublic = false;
  } else if (totalContributionsLastYear > 0 || Object.values(activityMap).some((c) => c > 0)) {
    isActivityPublic = true;
  }

  return {
    handle: cleanHandle,
    avatarUrl,
    totalContributionsLastYear,
    yearlyContributions,
    activityMap,
    publicRepos,
    isActivityPublic,
  };
}
