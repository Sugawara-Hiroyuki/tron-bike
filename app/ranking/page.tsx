import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RecentScores, ScoreSkeleton, TopScores } from "@/features/ranking/RankingList";

export const metadata: Metadata = {
  title: "RANKING",
};

export default function RankingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-6 py-12">
      <h1 className="neon-text text-center text-3xl tracking-widest text-cpu">RANKING</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm tracking-widest text-cpu">TOP 10</h2>
        <Suspense fallback={<ScoreSkeleton rows={10} />}>
          <TopScores />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm tracking-widest text-cpu">RECENT</h2>
        <Suspense fallback={<ScoreSkeleton rows={5} />}>
          <RecentScores />
        </Suspense>
      </section>

      <nav className="flex justify-center gap-8 text-sm tracking-widest text-foreground/70">
        <Link href="/" className="hover:text-cpu">
          ← TITLE
        </Link>
        <Link href="/play" className="hover:text-player">
          PLAY →
        </Link>
      </nav>
    </main>
  );
}
