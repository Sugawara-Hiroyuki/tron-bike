import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ の値はビルド時に埋め込まれるので、process.env.XXX と直接書く必要がある
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

// 環境変数が無いとき（ローカルで未設定など）はオンライン対戦を出さず、CPU 戦だけで遊べるようにする
export function isOnlineEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

// Realtime（Broadcast と Presence）だけを使う。DB とログインは使わないので、セッションは保存しない
export function getRealtime(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env is not set");
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
