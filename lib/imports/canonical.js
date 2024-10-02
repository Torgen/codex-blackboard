import { normalizeText } from "normalize-text";

// canonical names: lowercases, all non-letter, non-digit, non-emoji replaced with separator, defaulting to '_'
export default function (s, separator = "_") {
  // strip keycaps
  s = s.replace(/([A-Za-z0-9])\uFE0F\u20E3/gu, "$1");
  s = normalizeText(s);
  // suppress 's and 't
  s = s.replace(/[\'\u2019]([st])\b/g, "$1");
  // replace all non-alphanumeric, non-emoji with _
  s = s
    .replace(
      /[^\p{L}0-9\p{RI}\p{Emoji}\p{EMod}\u2600-\u26ff\u200D\uFE0F\u20E3]+/gu,
      separator
    )
    .replace(new RegExp(`^${separator}`), "")
    .replace(new RegExp(`${separator}$`), "");
  return s;
}
