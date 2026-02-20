/** Error code returned by API when message contains phone/email (for i18n on client) */
export const SENSITIVE_CONTACT_ERROR_CODE = "SENSITIVE_CONTACT_NOT_ALLOWED";

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const OBFUSCATED_EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[A-Za-z]{2,}\b/i;
const PHONE_LIKE_PATTERN = /\+?\d[\d\s().\-_/]{7,}\d\b|\b\d{9,15}\b/;
const OBFUSCATED_PHONE_PATTERN = /(?:\+?\d[\s().\-_/]*){9,15}/;
const CONTACT_INTENT_PATTERN =
  /\b(?:contact|phone|numero|tel|call|appel|whatsapp|wa|telegram|signal|email|mail|gmail|yahoo|outlook|instagram|facebook|fb|ig|dm|inbox)\b/i;
const OBFUSCATED_CONTACT_TOKEN_PATTERN = /(?:@|\(at\)|\[at\]|\sat\s|\(dot\)|\[dot\]|\sdot\s)/i;

function normalizedText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

function isNumericContactFragmentMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (!/^[\d\s().\-+/_]+$/.test(trimmed)) return false;

  const digits = digitsOnly(trimmed);
  return digits.length >= 1 && digits.length <= 8 && trimmed.length <= 24;
}

function isLikelyDigitFragmentMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Keep this strict to avoid false positives for normal chat.
  if (!/^[\d\s().\-+/_]+$/.test(trimmed)) return false;

  const digits = digitsOnly(trimmed);
  if (!digits.length || digits.length > 4) return false;

  return trimmed.length <= 12;
}

/**
 * Returns true if text contains something that looks like a phone number or email.
 * Used to block sending (API returns 400) rather than silently replacing.
 */
export function containsSensitiveContactInfo(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const normalized = normalizedText(trimmed);
  if (EMAIL_PATTERN.test(normalized) || OBFUSCATED_EMAIL_PATTERN.test(normalized)) {
    return true;
  }

  if (PHONE_LIKE_PATTERN.test(trimmed) || OBFUSCATED_PHONE_PATTERN.test(trimmed)) {
    return true;
  }

  // Fallback: dense digit stream after removing separators (covers simple obfuscation)
  const compactDigits = digitsOnly(trimmed);
  if (compactDigits.length >= 9 && compactDigits.length <= 15) return true;

  return false;
}

/**
 * Cheap pre-check to decide whether contextual moderation lookup is needed.
 * Avoids DB reads for clearly normal messages.
 */
export function shouldRunSensitiveContactSequenceCheck(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const normalized = normalizedText(trimmed);

  if (isNumericContactFragmentMessage(trimmed)) return true;
  if (CONTACT_INTENT_PATTERN.test(normalized)) return true;
  if (OBFUSCATED_CONTACT_TOKEN_PATTERN.test(normalized)) return true;

  return false;
}

/**
 * Detects contact-sharing attempts split across multiple short messages.
 * `recentMessages` should be recent messages from the same sender in the same conversation.
 */
export function containsSensitiveContactInMessageSequence(
  currentMessage: string,
  recentMessages: readonly string[]
): boolean {
  const window = [...recentMessages, currentMessage]
    .map((msg) => String(msg ?? "").trim())
    .filter(Boolean)
    .slice(-12);

  if (!window.length) return false;

  // Detect across joined content (e.g. "67 89" split into nearby messages)
  if (containsSensitiveContactInfo(window.join(" "))) return true;

  // Trailing fragment detector: catches 1-2 digit drip attempts.
  const trailingFragments: string[] = [];
  for (let i = window.length - 1; i >= 0; i -= 1) {
    if (!isLikelyDigitFragmentMessage(window[i])) break;
    trailingFragments.unshift(window[i]);
  }

  if (trailingFragments.length < 3) return false;

  const trailingDigits = digitsOnly(trailingFragments.join(""));

  // Aggressive enough to block leakage early, but still avoids most normal chat.
  if (trailingDigits.length >= 6) return true;

  return false;
}

/**
 * Filters sensitive information from text content
 * Used to prevent sharing of personal contact information, external communication channels, etc.
 */
export function filterSensitiveContent(text: string): string {
  // Filter phone numbers
  text = text.replace(
    /\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    "[phone number removed]"
  );

  // Filter email addresses
  text = text.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[email removed]"
  );

  // Filter WhatsApp mentions
  text = text.replace(/\b(?:whatsapp|whats app|wa)\b/gi, "[messaging app]");

  // Filter common meeting places or arrangements
  const sensitiveWords = [
    "meet",
    "meetup",
    "meeting",
    "contact",
    "call me",
    "text me",
    "message me",
    "dm me",
    "phone",
    "cell",
    "mobile",
    "email",
    "gmail",
    "yahoo",
    "outlook",
    "hotmail",
    "telegram",
    "signal",
    "facebook",
    "whatsapp",
    "wp",
    "fb",
    "instagram",
    "ig",
    "dm",
  ];

  const sensitivePattern = new RegExp(
    `\\b(${sensitiveWords.join("|")})\\b`,
    "gi"
  );
  text = text.replace(sensitivePattern, "[arrangement removed]");

  return text;
}

