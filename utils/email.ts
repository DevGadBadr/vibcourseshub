// Lightweight, practical email validation + typo suggestion used by many teams.
// Notes:
// - Syntax check is conservative (not RFC-5322 exhaustive) to avoid false negatives.
// - TLD/domain are checked against popular lists with Levenshtein suggestions
//   to catch common typos like `gamil.com` or `gmail.comn`.

export type EmailValidation = {
  ok: boolean;
  reason?: string;
  suggestion?: string; // suggested domain (full email) if a likely typo is detected
};

const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'pm.me',
];

const COMMON_TLDS = [
  'com','net','org','edu','gov','io','dev','app','me','co','ai','uk','de','fr','es','ca','au','in','eg'
];

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function nearest(value: string, list: string[], maxDistance = 2): string | undefined {
  let best: { s: string; d: number } | undefined;
  for (const s of list) {
    const d = levenshtein(value, s);
    if (d <= maxDistance && (!best || d < best.d)) best = { s, d };
  }
  return best?.s;
}

function isBasicEmailSyntax(email: string): boolean {
  // Conservative regex used in production (like HTML5 email pattern, but RN-safe)
  // - local: letters/digits and common symbols, dot-separated, not starting/ending with dot
  // - domain: labels of letters/digits/hyphens, separated by dots, TLD alpha-only 2-63
  const re = /^(?:[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*)@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$/;
  return re.test(email);
}

export function validateEmail(emailRaw: string): EmailValidation {
  const email = emailRaw.trim();
  if (!email) return { ok: false, reason: 'Email is required' };

  // Basic syntax check first
  if (!isBasicEmailSyntax(email)) {
    return { ok: false, reason: 'Enter a valid email address' };
  }

  // Heuristic typo checks on domain/TLD
  const [, domain = ''] = email.split('@');
  const domainLower = domain.toLowerCase();

  // If domain not in known list, try suggesting the nearest popular domain
  if (!COMMON_DOMAINS.includes(domainLower)) {
    const tld = domainLower.split('.').pop() || '';
    const withoutTld = domainLower.slice(0, -(tld.length + 1));

    const tldSuggestion = nearest(tld, COMMON_TLDS, 1);
    const domainSuggestion = nearest(domainLower, COMMON_DOMAINS, 2);

    const suggestedDomain = domainSuggestion || (tldSuggestion ? `${withoutTld}.${tldSuggestion}` : undefined);
    if (suggestedDomain && suggestedDomain !== domainLower) {
      return {
        ok: false,
        reason: 'This email looks mistyped',
        suggestion: `${email.split('@')[0]}@${suggestedDomain}`,
      };
    }
  }

  return { ok: true };
}
