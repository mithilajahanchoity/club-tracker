export type BeecrowdPublicProfile = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  ranking: string;
  points: string;
  joinedDate: string;
  submissionsCount: number;
  solvedCount: number;
  hardestSolved: string;
  about: string;
  motto: string;
  categorySolved: {
    Beginner: number;
    "Ad-Hoc": number;
    String: number;
    "Data Structures": number;
    Mathematics: number;
    Paradigms: number;
    Graph: number;
    Geometry: number;
    SQL: number;
  };
  submissionsByAnswer: Array<{ name: string; value: number; color: string }>;
  submissionsByLanguage: Array<{ name: string; value: number; color: string }>;
  monthlyProgress: Array<{ month: string; value: number }>;
  activityDates?: Record<string, number>;
};

const DEFAULT_CATEGORIES = {
  Beginner: 0,
  "Ad-Hoc": 0,
  String: 0,
  "Data Structures": 0,
  Mathematics: 0,
  Paradigms: 0,
  Graph: 0,
  Geometry: 0,
  SQL: 0,
};

const ANSWER_DEFS = [
  { key: "answer1", name: "Accepted", color: "#22c55e" },
  { key: "answer2", name: "Compilation error", color: "#eab308" },
  { key: "answer3", name: "Runtime error", color: "#06b6d4" },
  { key: "answer4", name: "Time limit exceeded", color: "#3b82f6" },
  { key: "answer5", name: "Presentation error", color: "#84cc16" },
  { key: "answer6", name: "Wrong answer", color: "#ef4444" },
  { key: "answer7", name: "Possible runtime error", color: "#a855f7" },
  { key: "answer11", name: "Memory limit exceeded", color: "#f97316" },
];

const LANG_DEFS = [
  { key: "cStats", name: "C", color: "#06b6d4" },
  { key: "cPlusStats", name: "C++", color: "#3b82f6" },
  { key: "cSharpStats", name: "C#", color: "#f97316" },
  { key: "javaStats", name: "Java", color: "#ef4444" },
  { key: "rubyStats", name: "Ruby", color: "#e11d48" },
  { key: "pythonStats", name: "Python", color: "#eab308" },
  { key: "scalaStats", name: "Scala", color: "#b91c1c" },
  { key: "luaStats", name: "Lua", color: "#2563eb" },
  { key: "javascriptStats", name: "JavaScript", color: "#84cc16" },
  { key: "goStats", name: "Go", color: "#00add8" },
  { key: "pgStats", name: "SQL", color: "#1d4ed8" },
  { key: "dartStats", name: "Dart", color: "#0284c7" },
  { key: "kotlinStats", name: "Kotlin", color: "#6366f1" },
  { key: "haskellStats", name: "Haskell", color: "#4338ca" },
  { key: "ocamlStats", name: "OCaml", color: "#c2410c" },
  { key: "pascalStats", name: "Pascal", color: "#f43f5e" },
  { key: "rStats", name: "R", color: "#22c55e" },
  { key: "phpStats", name: "PHP", color: "#6b7280" },
  { key: "clojureStats", name: "Clojure", color: "#15803d" },
  { key: "rustStats", name: "Rust", color: "#374151" },
  { key: "swiftStats", name: "Swift", color: "#ea580c" },
  { key: "tsStats", name: "TypeScript", color: "#3178c6" },
  { key: "juliaStats", name: "Julia", color: "#16a34a" },
  { key: "elixirStats", name: "Elixir", color: "#9333ea" },
];

export async function getBeecrowdPublicDetails(
  userId: string,
  dbSolved = 0,
  dbRank: number | null = null
): Promise<BeecrowdPublicProfile> {
  const cleanId = userId.trim();
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

  let username = cleanId;
  let avatarUrl: string | null = null;
  let ranking = dbRank != null ? `#${dbRank}` : "UNRANKED";
  let points = "0.00";
  let joinedDate = "—";
  let submissionsCount = dbSolved > 0 ? Math.round(dbSolved * 1.5) : 0;
  let solvedCount = dbSolved;
  let hardestSolved = "—";
  let about = "Competitive programming club member";
  let motto = "No information provided";
  const categorySolved = { ...DEFAULT_CATEGORIES };
  const parsedAnswers: Array<{ name: string; value: number; color: string }> = [];
  const parsedLanguages: Array<{ name: string; value: number; color: string }> = [];
  let parsedProgress: Array<{ month: string; value: number }> = [];
  const activityDates: Record<string, number> = {};

  try {
    let html = "";

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

      if (fcRes.ok) {
        const fcData = await fcRes.json().catch(() => null);
        html = fcData?.data?.rawHtml || fcData?.data?.html || "";
      }
    } else {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
      if (process.env.BEECROWD_COOKIE) {
        headers["Cookie"] = process.env.BEECROWD_COOKIE;
      }

      const res = await fetch(fetchUrl, {
        headers,
        signal: AbortSignal.timeout(process.env.BEECROWD_PROXY_URL ? 25000 : 8000),
        cache: "no-store",
      });

      if (res.ok) {
        html = await res.text();
      }
    }

    if (html && !html.includes("Just a moment...") && !html.includes("cf-browser-verification")) {
      // 1. Username
      const nameMatch =
        html.match(/class="profile-name-text"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/<title>beecrowd\s*\|\s*([^@<]+)@/i) ||
        html.match(/class="profile-name"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/<h1[^>]*>\s*([A-Za-z0-9._-]+)\s*<\/h1>/i);
      if (nameMatch) username = nameMatch[1].trim();

      // 2. Avatar (only custom user uploaded photo, never system UI SVGs like purple-trophy.svg)
      const avatarMatch =
        html.match(/<div[^>]*class="profile-pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i) ||
        html.match(/<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]+)"/i) ||
        html.match(/<img[^>]*src="([^"]*(?:photos|avatars|user-photo)[^"]*)"/i);
      if (
        avatarMatch &&
        avatarMatch[1].startsWith("http") &&
        !avatarMatch[1].endsWith(".svg") &&
        !avatarMatch[1].includes("/img/profile/")
      ) {
        avatarUrl = avatarMatch[1];
      }

      // 3. Points
      const pointsMatch =
        html.match(/class="profile-rank-points-text"[^>]*>([\d,.]+)<\/span>/i) ||
        html.match(/Points:\s*<\/span>\s*<span[^>]*>([\d,.]+)/i) ||
        html.match(/(?:Points|Pontos)[^\d]{1,50}([\d,.]+)/i);
      if (pointsMatch) points = pointsMatch[1].trim();

      // 4. Rank
      const rankMatch =
        html.match(/class="profile-rank-text"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/Rank:\s*<\/span>\s*<span[^>]*>([^<]+)/i) ||
        html.match(/(?:Rank|Posição|Posicao)[^\d]{1,50}([\d,]+|UNRANKED)/i);
      if (rankMatch) {
        const r = rankMatch[1].trim();
        ranking = /^\d[\d,.]*$/.test(r) ? `#${r}` : r;
      }

      // 5. Joined Date
      const joinedMatch =
        html.match(/class="profile-infos-join-date"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/Joined:[^\d]{1,20}(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (joinedMatch) joinedDate = joinedMatch[1].trim();

      // 6. Solved Count
      const solvedMatch =
        html.match(/class="profile-solved-number"[^>]*>(\d+)<\/span>/i) ||
        html.match(/Solved:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        html.match(/(?:Solved|Solucionados)[^\d]{1,50}(\d+)/i);
      if (solvedMatch) solvedCount = parseInt(solvedMatch[1], 10);

      // 7. Submissions Count
      const subsMatch =
        html.match(/class="profile-submissions-number"[^>]*>(\d+)<\/span>/i) ||
        html.match(/Submissions:\s*<\/span>\s*<span[^>]*>(\d+)/i) ||
        html.match(/(?:Submissions|Submissões|Submissoes)[^\d]{1,50}(\d+)/i);
      if (subsMatch) submissionsCount = parseInt(subsMatch[1], 10);

      // 8. Hardest Solved
      const hardestMatch =
        html.match(/class="profile-hardest-number"[^>]*>([^<]+)<\/span>/i) ||
        html.match(/Hardest Solved:\s*<\/span>\s*<span[^>]*>([^<]+)/i);
      if (hardestMatch) hardestSolved = hardestMatch[1].trim();

      // 9. About & Motto
      const aboutMatch = html.match(/About[^\w<]{0,50}<\/[^>]+>\s*<p[^>]*>([^<]+)<\/p>/i);
      if (aboutMatch && aboutMatch[1].trim()) about = aboutMatch[1].trim();
      const mottoMatch = html.match(/Motto[^\w<]{0,50}<\/[^>]+>\s*<p[^>]*>([^<]+)<\/p>/i);
      if (mottoMatch && mottoMatch[1].trim()) motto = mottoMatch[1].trim();

      // 10. Radar Chart Categories
      const radarMatch = html.match(
        /\$\(['"]#radar-chart['"]\)[\s\S]*?datasets:\s*\[\s*\{[\s\S]*?data:\s*\[([\s\d,.]+)\]/
      );
      if (radarMatch) {
        const nums = radarMatch[1].split(",").map((s) => Number(s.trim()));
        if (nums.length >= 9) {
          categorySolved.Beginner = nums[0] || 0;
          categorySolved["Ad-Hoc"] = nums[1] || 0;
          categorySolved.String = nums[2] || 0;
          categorySolved["Data Structures"] = nums[3] || 0;
          categorySolved.Mathematics = nums[4] || 0;
          categorySolved.Paradigms = nums[5] || 0;
          categorySolved.Graph = nums[6] || 0;
          categorySolved.Geometry = nums[7] || 0;
          categorySolved.SQL = nums[8] || 0;
        }
      }

      // 11. Submissions by Answer (Verdicts)
      for (const a of ANSWER_DEFS) {
        const m = html.match(new RegExp(`(?:let|var)?\\s*${a.key}\\s*[:=]\\s*(\\d+)`));
        const val = m ? parseInt(m[1], 10) : 0;
        if (val > 0) {
          parsedAnswers.push({ name: a.name, value: val, color: a.color });
        }
      }

      // 12. Submissions by Language
      for (const lang of LANG_DEFS) {
        const m = html.match(new RegExp(`(?:let|var)?\\s*${lang.key}\\s*[:=]\\s*(\\d+)`));
        const val = m ? parseInt(m[1], 10) : 0;
        if (val > 0) {
          parsedLanguages.push({ name: lang.name, value: val, color: lang.color });
        }
      }

      // 13. Progress (past 6 months)
      const progressMatch = html.match(
        /\$\(['"]#progress-chart['"]\)[\s\S]*?labels:\s*\[([\s\S]*?)\][\s\S]*?data:\s*\[([\s\d,.]+)\]/
      );
      if (progressMatch) {
        const labels = progressMatch[1].match(/'[^']+'|"[^"]+"/g)?.map((s) => s.replace(/['"]/g, "")) || [];
        const vals = progressMatch[2].split(",").map((s) => Number(s.trim()));
        parsedProgress = labels.map((month, idx) => ({
          month,
          value: vals[idx] ?? (vals[vals.length - 1] || 0),
        }));
      }

      // 14. Activity HeatMap Calendar Data (from cal.init)
      const calMatch = html.match(/cal\.init\(\{[\s\S]*?data:\s*(\{[\s\S]*?\}|\[\])/);
      if (calMatch && calMatch[1].startsWith("{")) {
        try {
          const rawData = JSON.parse(calMatch[1]);
          for (const [secStr, count] of Object.entries(rawData)) {
            const sec = Number(secStr);
            if (!isNaN(sec) && sec > 0) {
              const dateStr = new Date((sec + 6 * 3600) * 1000).toISOString().slice(0, 10);
              activityDates[dateStr] = (activityDates[dateStr] ?? 0) + Number(count || 1);
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }
  } catch {
    // Graceful fallback to database values if network/Firecrawl restrictions
  }

  // Submissions by answer: only real parsed verdicts or honest baseline
  const submissionsByAnswer =
    parsedAnswers.length > 0
      ? parsedAnswers
      : solvedCount > 0
      ? [
          { name: "Accepted", value: solvedCount, color: "#22c55e" },
          ...(submissionsCount > solvedCount
            ? [{ name: "Other verdicts", value: submissionsCount - solvedCount, color: "#ef4444" }]
            : []),
        ]
      : [];

  // Submissions by language: strictly genuine languages parsed from the profile
  const submissionsByLanguage = parsedLanguages;

  // 6 months progress line: real parsed progress or baseline based on solvedCount
  const now = new Date();
  const monthlyProgress =
    parsedProgress.length > 0
      ? parsedProgress
      : Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const mStr = String(d.getMonth() + 1).padStart(2, "0");
          const yStr = String(d.getFullYear()).slice(2);
          return {
            month: `${mStr}/${yStr}`,
            value: solvedCount,
          };
        });

  return {
    userId: cleanId,
    username,
    avatarUrl,
    ranking,
    points,
    joinedDate,
    submissionsCount,
    solvedCount,
    hardestSolved,
    about,
    motto,
    categorySolved,
    submissionsByAnswer,
    submissionsByLanguage,
    monthlyProgress,
    activityDates,
  };
}
