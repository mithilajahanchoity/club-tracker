import type { ReactNode } from "react";

export function CodeforcesIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="9.5" width="5.5" height="11.5" rx="1.5" fill="#FFC107" />
      <rect x="9.25" y="3" width="5.5" height="18" rx="1.5" fill="#2196F3" />
      <rect x="16.5" y="6.5" width="5.5" height="14.5" rx="1.5" fill="#EF4444" />
    </svg>
  );
}

export function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function HackerRankIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#00EA64" />
      <path
        d="M6.5 5.5h2.8v5.2h5.4V5.5h2.8v13h-2.8v-5.2H9.3v5.2H6.5V5.5z"
        fill="#000000"
      />
    </svg>
  );
}

export function BeecrowdIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      {/* Wings */}
      <ellipse cx="8.5" cy="6.5" rx="3.5" ry="4.5" transform="rotate(-25 8.5 6.5)" fill="#60A5FA" fillOpacity="0.85" />
      <ellipse cx="15.5" cy="6.5" rx="3.5" ry="4.5" transform="rotate(25 15.5 6.5)" fill="#93C5FD" fillOpacity="0.85" />
      {/* Antennas */}
      <path d="M10 9L7.5 4.5M14 9L16.5 4.5" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.2" cy="4.2" r="1" fill="#1F2937" />
      <circle cx="16.8" cy="4.2" r="1" fill="#1F2937" />
      {/* Body with stripes */}
      <ellipse cx="12" cy="14" rx="7" ry="8" fill="#FBBF24" />
      {/* Black stripes */}
      <path d="M5.5 12h13M5 15h14M6.5 18h11" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />
      {/* Stinger */}
      <polygon points="12,22 10.5,20 13.5,20" fill="#1F2937" />
    </svg>
  );
}

export function VJudgeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#2D3748" stroke="#4A5568" strokeWidth="1" />
      {/* Yellow Face */}
      <circle cx="12" cy="12" r="8" fill="#FACC15" />
      {/* Sunglasses */}
      <path
        d="M6.8 10.2h10.4c.3 0 .5.3.4.6l-.6 2.2c-.2.7-.8 1.2-1.5 1.2h-1.8c-.8 0-1.4-.6-1.5-1.3l-.2-1.2h-.4l-.2 1.2c-.1.7-.7 1.3-1.5 1.3H8c-.7 0-1.3-.5-1.5-1.2l-.6-2.2c-.1-.3.1-.6.4-.6z"
        fill="#18181B"
      />
      {/* Smirk */}
      <path d="M9.5 16.5c1 .6 2.5.6 3.5 0" stroke="#18181B" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CodeChefIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M6 16h12v4H6v-4zm0 0c-1.8 0-3-1.5-3-3.2 0-1.6 1.1-2.9 2.6-3.1C5.2 7.8 6.7 6 8.7 6c.9 0 1.8.4 2.4 1.1.7-.7 1.7-1.1 2.8-1.1 2 0 3.7 1.7 3.8 3.7 1.4.3 2.3 1.5 2.3 3.1 0 1.7-1.2 3.2-3 3.2H6z"
        fill="#5B4638"
      />
    </svg>
  );
}

export function LeetCodeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z"
        fill="#FFA116"
      />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className = "h-4 w-4",
  fallback = "🔗",
}: {
  platform: string;
  className?: string;
  fallback?: ReactNode;
}) {
  switch (platform.toLowerCase()) {
    case "codeforces":
      return <CodeforcesIcon className={className} />;
    case "github":
      return <GitHubIcon className={className} />;
    case "hackerrank":
      return <HackerRankIcon className={className} />;
    case "beecrowd":
      return <BeecrowdIcon className={className} />;
    case "vjudge":
      return <VJudgeIcon className={className} />;
    case "codechef":
      return <CodeChefIcon className={className} />;
    case "leetcode":
      return <LeetCodeIcon className={className} />;
    default:
      return <span className={className}>{fallback}</span>;
  }
}
