"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isOnlineEnabled } from "./client";
import { entryCandidates, openLobby } from "./lobby";

// 誰かが乱入を受け付けて CPU 戦をしているときだけ出る ENTRY ボタン
export default function EntryButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isOnlineEnabled()) return;
    // 見るだけで track はしない（トップにいる人は乱入先の候補にならない）
    const lobby = openLobby({
      onMembers: (members) => setAvailable(entryCandidates(members).length > 0),
    });
    return () => lobby.close();
  }, []);

  if (!available) return null;
  return (
    <Link
      href="/play?entry=1"
      className="neon-box animate-pulse border border-cpu px-10 py-3 tracking-widest text-cpu transition-colors hover:bg-cpu/10"
    >
      ENTRY
    </Link>
  );
}
