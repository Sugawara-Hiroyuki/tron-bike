export const NAME_MAX_LENGTH = 12;

// 文字（かな・漢字・英字など）と数字で始まり、途中に空白・ハイフン・アンダースコアを含められる。
// 記号・絵文字・制御文字・ゼロ幅文字を通さないことで、URL や見えない文字での荒らしを防ぐ
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

// 表示用に整えた名前を返す。使えない名前なら null
export function normalizeName(raw: string): string | null {
  // 全角英数や合成文字を揃え、連続した空白を1つにまとめる
  const name = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  const length = [...name].length;
  if (length < 1 || length > NAME_MAX_LENGTH) return null;
  if (!NAME_PATTERN.test(name)) return null;
  return name;
}
