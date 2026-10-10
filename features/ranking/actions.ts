"use server";

import { updateTag } from "next/cache";
import { maxScoreAtStage } from "@/features/game/engine";
import { getSql } from "@/lib/db";
import { NAME_MAX_LENGTH, normalizeName } from "./name";
import { SCORES_TAG } from "./queries";

export type SubmitScoreState = {
  status: "idle" | "success" | "error";
  message: string;
};

const STAGE_MAX = 999;

// Server Action は公開された POST エンドポイントなので、フォームの値は必ずここで検証する
export async function submitScore(
  _prevState: SubmitScoreState,
  formData: FormData,
): Promise<SubmitScoreState> {
  const name = normalizeName(String(formData.get("name") ?? ""));
  const score = Number(formData.get("score"));
  const stage = Number(formData.get("stage"));

  if (name === null) {
    return {
      status: "error",
      message: `名前は1〜${NAME_MAX_LENGTH}文字で、文字と数字のみ使えます（記号・絵文字は不可）`,
    };
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

  // 自分の登録がすぐランキングに出るよう、キャッシュ済みの上位一覧を即時に無効化する
  updateTag(SCORES_TAG);
  return { status: "success", message: "スコアを登録しました" };
}
