/** Error code returned by API when message contains phone/email (for i18n on client) */
export const SENSITIVE_CONTACT_ERROR_CODE = "SENSITIVE_CONTACT_NOT_ALLOWED";

/**
 * Returns true if text contains something that looks like a phone number or email.
 * Used to block sending (API returns 400) rather than silently replacing.
 */
export function containsSensitiveContactInfo(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const emailPattern =
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  if (emailPattern.test(trimmed)) return true;

  const phoneLikePattern =
    /\+?\d[\d\s.\-]{8,}\d\b|\b\d{9,15}\b/;
  if (phoneLikePattern.test(trimmed)) return true;

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

