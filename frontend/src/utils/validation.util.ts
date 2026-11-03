export const MAX_RECIPIENTS = 500;

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_REGEX.test(s.trim());
}

export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  if (!raw || !raw.trim()) {
    return { valid: [], invalid: [] };
  }

  // Split on newlines, commas, semicolons
  const parts = raw
    .split(/[\r\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const part of parts) {
    if (isValidEmail(part)) {
      valid.push(part);
    } else {
      invalid.push(part);
    }
  }

  return { valid, invalid };
}

export function dedupe(list: string[]): { unique: string[]; duplicateCount: number } {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const email of list) {
    const normalized = email.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(email.trim());
    }
  }

  return {
    unique,
    duplicateCount: list.length - unique.length,
  };
}

export function isStartAtValid(iso: string, now: Date = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return false;

  // Grace window: now - 60 seconds <= startAt
  const graceWindowMs = 60 * 1000;
  return date.getTime() >= now.getTime() - graceWindowMs;
}

