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

