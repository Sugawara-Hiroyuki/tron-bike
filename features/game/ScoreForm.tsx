"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitScore, type SubmitScoreState } from "@/features/ranking/actions";

const INITIAL_STATE: SubmitScoreState = { status: "idle", message: "" };

export default function ScoreForm({ score, stage }: { score: number; stage: number }) {
  const [state, formAction, pending] = useActionState(submitScore, INITIAL_STATE);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-2 text-sm tracking-widest">
        <p className="text-player">{state.message}</p>
        <Link href="/ranking" className="text-foreground underline hover:text-player">
          RANKING を見る
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="score" value={score} />
      <input type="hidden" name="stage" value={stage} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={12}
          placeholder="NAME"
          aria-label="名前"
          autoComplete="off"
          className="w-40 border border-foreground/60 bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-player"
        />
        <button
          disabled={pending}
          className="border border-player px-4 py-2 text-sm tracking-widest text-player hover:bg-player/10 disabled:opacity-50"
        >
          {pending ? "送信中…" : "登録"}
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-xs text-cpu">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
