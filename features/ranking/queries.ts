import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getSql } from "@/lib/db";

export const SCORES_TAG = "scores";

export type ScoreRow = {
  id: number;
  name: string;
  score: number;
  stage: number;
  createdAt: string;
};

const TOP_LIMIT = 10;
const RECENT_LIMIT = 5;

// 上位は頻繁には変わらないのでキャッシュする。スコア登録時に SCORES_TAG で即時に無効化される
export async function getTopScores(): Promise<ScoreRow[]> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("minutes");

  const sql = getSql();
  const rows = await sql`
    select id::int as id, name, score, stage, created_at::text as "createdAt"
    from scores
    order by score desc, created_at asc
    limit ${TOP_LIMIT}
  `;
  return rows as ScoreRow[];
}

// こちらはキャッシュしない。リクエストのたびに DB を読むので <Suspense> の中で使う
export async function getRecentScores(): Promise<ScoreRow[]> {
  const sql = getSql();
  const rows = await sql`
    select id::int as id, name, score, stage, created_at::text as "createdAt"
    from scores
    order by created_at desc
    limit ${RECENT_LIMIT}
  `;
  return rows as ScoreRow[];
}
