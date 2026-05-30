/**
 * Render a UAH amount as Ukrainian text for the act's "Загальна вартість" line:
 * the hryvnia part in words (feminine гривня declension) followed by kopecks as
 * two digits, e.g. `200.00 → "двісті гривень 00 коп."`,
 * `2000.00 → "дві тисячі гривень 00 коп."`, `1 → "одна гривня 00 коп."`.
 *
 * Pure — no Next.js / runtime imports.
 */

const ONES_MASC = ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const ONES_FEM = ["", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"];
const TEENS = [
  "десять",
  "одинадцять",
  "дванадцять",
  "тринадцять",
  "чотирнадцять",
  "п'ятнадцять",
  "шістнадцять",
  "сімнадцять",
  "вісімнадцять",
  "дев'ятнадцять",
];
const TENS = [
  "",
  "",
  "двадцять",
  "тридцять",
  "сорок",
  "п'ятдесят",
  "шістдесят",
  "сімдесят",
  "вісімдесят",
  "дев'яносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двісті",
  "триста",
  "чотириста",
  "п'ятсот",
  "шістсот",
  "сімсот",
  "вісімсот",
  "дев'ятсот",
];

type PluralForms = readonly [one: string, few: string, many: string];

const HRYVNIA: PluralForms = ["гривня", "гривні", "гривень"];
const THOUSAND: PluralForms = ["тисяча", "тисячі", "тисяч"];
const MILLION: PluralForms = ["мільйон", "мільйони", "мільйонів"];
const BILLION: PluralForms = ["мільярд", "мільярди", "мільярдів"];

/** Ukrainian plural selection: 1 → one, 2-4 → few, else many (11-14 are many). */
function pluralForm(n: number, forms: PluralForms): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Words for a 0..999 group; `feminine` selects одна/дві vs один/два. */
function tripleToWords(n: number, feminine: boolean): string[] {
  const ones = feminine ? ONES_FEM : ONES_MASC;
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (h) words.push(HUNDREDS[h]!);
  if (t >= 2) {
    words.push(TENS[t]!);
    if (u) words.push(ones[u]!);
  } else if (t === 1) {
    words.push(TEENS[u]!);
  } else if (u) {
    words.push(ones[u]!);
  }
  return words;
}

function integerToWords(num: number): string[] {
  if (num === 0) return ["нуль"];
  const billions = Math.floor(num / 1_000_000_000) % 1000;
  const millions = Math.floor(num / 1_000_000) % 1000;
  const thousands = Math.floor(num / 1000) % 1000;
  const units = num % 1000;

  const parts: string[] = [];
  if (billions) parts.push(...tripleToWords(billions, false), pluralForm(billions, BILLION));
  if (millions) parts.push(...tripleToWords(millions, false), pluralForm(millions, MILLION));
  if (thousands) parts.push(...tripleToWords(thousands, true), pluralForm(thousands, THOUSAND));
  if (units) parts.push(...tripleToWords(units, true));
  return parts;
}

/**
 * @param amount UAH amount as a number or numeric string (e.g. 200, "2000.00").
 * @returns e.g. "двісті гривень 00 коп."
 */
export function uahInWords(amount: number | string): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`uahInWords: invalid amount ${String(amount)}`);
  }
  const cents = Math.round(n * 100);
  const hryvnias = Math.floor(cents / 100);
  const kopecks = cents % 100;

  const words = integerToWords(hryvnias).join(" ");
  const hryvniaNoun = pluralForm(hryvnias, HRYVNIA);
  const kk = String(kopecks).padStart(2, "0");

  return `${words} ${hryvniaNoun} ${kk} коп.`;
}
