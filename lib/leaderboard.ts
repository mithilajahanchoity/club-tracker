// Pure ranking logic for the three leaderboards. No database access here,
// so it is easy to test. The database function get_leaderboard() does the
// scoring; this file only sorts and ranks its output.

export type LeaderRow = {
  profile_id: string;
  full_name: string;
  batch: string;
  solved: number;
  contributions: number;
  contests: number;
  active_days: number;
  score: number;
  prev_score: number;
  visible: boolean;
};

export type RankedRow = {
  row: LeaderRow;
  rank: number; // tied members share a rank (1, 1, 3)
  value: number; // the number the board is sorted by
};

type Compare = (a: LeaderRow, b: LeaderRow) => number;

function rankRows(
  rows: LeaderRow[],
  eligible: (r: LeaderRow) => boolean,
  compare: Compare,
  value: (r: LeaderRow) => number
): RankedRow[] {
  const sorted = rows
    .filter(eligible)
    .sort((a, b) => compare(a, b) || a.full_name.localeCompare(b.full_name));

  let place = 0;
  return sorted.map((row, i) => {
    if (i === 0 || compare(sorted[i - 1], row) !== 0) place = i + 1;
    return { row, rank: place, value: value(row) };
  });
}

export const improvement = (r: LeaderRow) => r.score - r.prev_score;

export function buildBoards(rows: LeaderRow[]) {
  return {
    // Highest points in the period.
    top: rankRows(
      rows,
      (r) => r.score > 0,
      (a, b) => b.score - a.score || b.solved - a.solved,
      (r) => r.score
    ),
    // Most days with any activity. Rewards steady effort over big bursts.
    consistent: rankRows(
      rows,
      (r) => r.active_days > 0,
      (a, b) => b.active_days - a.active_days || b.score - a.score,
      (r) => r.active_days
    ),
    // Biggest gain compared with the period right before.
    improved: rankRows(
      rows,
      (r) => improvement(r) > 0,
      (a, b) => improvement(b) - improvement(a),
      improvement
    ),
  };
}
