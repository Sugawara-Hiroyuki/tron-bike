// 「乱入を受け付けるか」の設定。localStorage に残し、useSyncExternalStore とゲームループの両方から読む
const STORAGE_KEY = "light-bike:accepts-entry";

const listeners = new Set<() => void>();
let cached: boolean | null = null;

export function getAccepts(): boolean {
  if (cached === null) {
    try {
      cached = localStorage.getItem(STORAGE_KEY) !== "0";
    } catch {
      cached = true;
    }
  }
  return cached;
}

// サーバーで描くときは初期値（受け付ける）にしておく
export function getServerAccepts(): boolean {
  return true;
}

export function setAccepts(accepts: boolean): void {
  cached = accepts;
  try {
    localStorage.setItem(STORAGE_KEY, accepts ? "1" : "0");
  } catch {
    // 保存できなくても、このページを開いている間は設定が効く
  }
  for (const listener of listeners) listener();
}

export function subscribeAccepts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
