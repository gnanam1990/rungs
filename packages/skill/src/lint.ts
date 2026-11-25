// Copy checks shared by the skill, llms.txt, prompts and the web app (T-K05, T-K08, T-W10).

/** Words and phrases the product never uses (hackathon red line 7 and UI spec section 6). */
export const BANNED_PHRASES = [
  "passive income",
  "automatic money",
  "money-making",
  "guaranteed",
  "risk-free",
  "risk free",
  "free money",
  "instant cash",
  "apy",
  "yield",
  "earn",
  "free",
] as const;

/** Returns the banned phrases found, matched as whole words, case-insensitive. */
export function findBannedPhrases(text: string): string[] {
  const hits: string[] = [];
  for (const p of BANNED_PHRASES) {
    const word = p.replace(/[-\s]/g, (c) => (c === "-" ? "-" : "\\s+"));
    const re = p === "earn" ? /\bearn(s|ed|ing)?\b/i : new RegExp(`\\b${word}\\b`, "i");
    if (re.test(text)) hits.push(p);
  }
  return hits;
}

const BYPASS =
  /\b(skip|skipping|bypass|pre-?approve|pre-?authori[sz]e|auto-?(approve|confirm|execute|sign)|batch|bundle|without (asking|waiting|confirm\w*|a yes|(the )?user'?s? (yes|confirmation|approval))|in one go)\b/i;
const ALWAYS_BAD = /\b(don'?t|do not|no need to) (ask|wait|confirm|show)\b/i;
const NEGATION = /\b(never|do not|don'?t|must not|not|no)\b/i;

/**
 * Sentences that tell an agent to skip, pre-approve or batch the user's confirmations (red line 2).
 * A sentence that forbids such a thing ("Never …", "Do not …") is allowed.
 */
export function findConfirmationBypass(text: string): string[] {
  const sentences = text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.filter((s) => ALWAYS_BAD.test(s) || (BYPASS.test(s) && !NEGATION.test(s)));
}
