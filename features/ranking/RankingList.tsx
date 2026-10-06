import { getRecentScores, getTopScores, type ScoreRow } from "./queries";

function ScoreTable({ rows, ranked }: { rows: ScoreRow[]; ranked: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground/60">まだスコアがありません</p>;
  }
  return (
    <ol className="flex flex-col gap-1 font-mono text-sm">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className="grid grid-cols-[2.5rem_1fr_4rem_5rem] items-baseline gap-3 border-b border-grid py-1"
        >
          <span className="text-foreground/60">{ranked ? index + 1 : "-"}</span>
          <span className="truncate">{row.name}</span>
          <span className="text-right text-foreground/60">ST {row.stage}</span>
          <span className="text-right text-player">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}

export async function TopScores() {
  const rows = await getTopScores();
  return <ScoreTable rows={rows} ranked />;
}

export async function RecentScores() {
  const rows = await getRecentScores();
  return <ScoreTable rows={rows} ranked={false} />;
}

export function ScoreSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-7 animate-pulse border-b border-grid bg-grid/40" />
      ))}
    </div>
  );
}
