import type { RealtimeChannel } from "@supabase/supabase-js";
import { getRealtime } from "./client";

// solo: CPU 戦中（乱入できる候補）、entry: 乱入先を探している、versus: 対戦中または対戦の準備中、away: タブが裏にある
export type LobbyStatus = "solo" | "entry" | "versus" | "away";

export type LobbyMember = {
  clientId: string;
  status: LobbyStatus;
  // 乱入を受け付けるか
  accepts: boolean;
  // /play を開いた時刻。乱入先は一番長く遊んでいる人にする
  since: number;
};

export type Challenge = { from: string; to: string };
export type ChallengeReply = { from: string; to: string; ok: boolean; roomId: string | null };

export type Lobby = {
  track: (member: LobbyMember) => void;
  challenge: (challenge: Challenge) => void;
  reply: (reply: ChallengeReply) => void;
  close: () => void;
};

type LobbyHandlers = {
  onMembers?: (members: LobbyMember[]) => void;
  onChallenge?: (challenge: Challenge) => void;
  onReply?: (reply: ChallengeReply) => void;
};

// 乱入できる相手を、一番長く遊んでいる順に並べる
export function entryCandidates(members: LobbyMember[], selfId?: string): LobbyMember[] {
  return members
    .filter((m) => m.clientId !== selfId && m.status === "solo" && m.accepts)
    .sort((a, b) => a.since - b.since);
}

type Listener = LobbyHandlers & { tracking: boolean };

type SharedLobby = {
  channel: RealtimeChannel;
  subscribed: boolean;
  listeners: Set<Listener>;
  members: LobbyMember[] | null;
  tracked: LobbyMember | null;
};

let shared: SharedLobby | null = null;

function readMembers(channel: RealtimeChannel): LobbyMember[] {
  const state = channel.presenceState<LobbyMember>();
  return Object.values(state)
    .flatMap((presences) => presences.slice(0, 1))
    .map(({ clientId, status, accepts, since }) => ({ clientId, status, accepts, since }));
}

// 全員が入る 1 つのチャンネル。Presence で「誰が CPU 戦中か」を知らせ、Broadcast で乱入の申し込みと返事をやりとりする。
// 同じ名前のチャンネルは、外している途中に作り直すと外れかけの古いものが返ってくるので、ページを開いている間は 1 本を使い回す
function getSharedLobby(): SharedLobby {
  if (shared) return shared;
  const channel = getRealtime().channel("lobby", {
    config: { broadcast: { self: false }, presence: { enabled: true } },
  });
  const lobby: SharedLobby = {
    channel,
    subscribed: false,
    listeners: new Set(),
    members: null,
    tracked: null,
  };
  channel
    .on("presence", { event: "sync" }, () => {
      lobby.members = readMembers(channel);
      for (const listener of lobby.listeners) listener.onMembers?.(lobby.members);
    })
    .on("broadcast", { event: "challenge" }, ({ payload }) => {
      for (const listener of lobby.listeners) listener.onChallenge?.(payload as Challenge);
    })
    .on("broadcast", { event: "reply" }, ({ payload }) => {
      for (const listener of lobby.listeners) listener.onReply?.(payload as ChallengeReply);
    })
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      lobby.subscribed = true;
      // 接続前に track されていたら、接続できたところで送る
      if (lobby.tracked) void channel.track(lobby.tracked);
    });
  shared = lobby;
  return lobby;
}

export function openLobby(handlers: LobbyHandlers): Lobby {
  const lobby = getSharedLobby();
  const listener: Listener = { ...handlers, tracking: false };
  lobby.listeners.add(listener);
  // すでに接続済みなら、いまの顔ぶれをすぐ渡す
  if (lobby.members) {
    const members = lobby.members;
    queueMicrotask(() => {
      if (lobby.listeners.has(listener)) listener.onMembers?.(members);
    });
  }

  return {
    track: (member) => {
      listener.tracking = true;
      lobby.tracked = member;
      if (lobby.subscribed) void lobby.channel.track(member);
    },
    challenge: (challenge) => {
      void lobby.channel.send({ type: "broadcast", event: "challenge", payload: challenge });
    },
    reply: (reply) => {
      void lobby.channel.send({ type: "broadcast", event: "reply", payload: reply });
    },
    close: () => {
      lobby.listeners.delete(listener);
      if (!listener.tracking) return;
      lobby.tracked = null;
      if (lobby.subscribed) void lobby.channel.untrack();
    },
  };
}

// crypto.randomUUID は HTTPS か localhost でしか使えない（スマホから LAN の IP で開いたときにも動くようにする）
export function randomId(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("");
}
