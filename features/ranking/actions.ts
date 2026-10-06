"use server";

import { maxScoreAtStage } from "@/features/game/engine";
import { getSql } from "@/lib/db";

export type SubmitScoreState = {
  status: "idle" | "success" | "error";
  message: string;
};

const NAME_MAX_LENGTH = 12;
const STAGE_MAX = 999;

// Server Action は公開された POST エンドポイントなので、フォームの値は必ずここで検証する
export async function submitScore(
  _prevState: SubmitScoreState,
  formData: FormData,
): Promise<SubmitScoreState> {
  const name = String(formData.get("name") ?? "").trim();
  const score = Number(formData.get("score"));
  const stage = Number(formData.get("stage"));

  if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
    return { status: "error", message: `名前は1〜${NAME_MAX_LENGTH}文字で入力してください` };
  }
  if (!Number.isInteger(stage) || stage < 1 || stage > STAGE_MAX) {
    return { status: "error", message: "ステージの値が不正です" };
  }
  if (!Number.isInteger(score) || score <= 0 || score > maxScoreAtStage(stage)) {
    return { status: "error", message: "スコアの値が不正です" };
  }

  try {
    const sql = getSql();
    await sql`insert into scores (name, score, stage) values (${name}, ${score}, ${stage})`;
  } catch {
    return { status: "error", message: "スコアを保存できませんでした。時間をおいて試してください" };
  }

  return { status: "success", message: "スコアを登録しました" };
}
