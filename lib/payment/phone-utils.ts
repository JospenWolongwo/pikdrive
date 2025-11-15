/**
 * Phone number utilities for operator detection (MTN vs Orange)
 * Matches MOMO_OM_PAYMENT_ABSTRUCTION.md specifications
 */

/**
 * Remove all special characters from a string (for payment reasons/descriptions)
 */
export function removeAllSpecialCaracter(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, " ");
}

/**
 * Generate random ID for transaction references
 */
export function randomId(idLength: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < idLength; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Remove calling code from phone number
 * Handles various formats: +237, 237, etc.
 */
export function removeCallingCode(phoneNumber: string): string | null {
  try {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/[^\d]/g, "");

    // If it starts with 237 (Cameroon), remove it
    if (cleaned.startsWith("237") && cleaned.length >= 12) {
      return cleaned.substring(3);
    }

    // If it's already 9 digits (without country code), return as is
    if (cleaned.length === 9) {
      return cleaned;
    }

    // If it's 12 digits and starts with 237, extract the national number
    if (cleaned.length === 12 && cleaned.startsWith("237")) {
      return cleaned.substring(3);
    }

    // Invalid format
    return null;
  } catch (error: any) {
    console.error("Error parsing phone number:", error.message);
    return null;
  }
}

/**
 * Check if phone number belongs to Orange Money network
 * Orange numbers: 69XX, 655-659 (prefix 6 then 9 or 5[5-9])
 */
export function isOrangePhoneNumber(phoneNumber: string): boolean {
  const formattedPhone = removeCallingCode(phoneNumber);
  if (!formattedPhone) return false;

  // Orange pattern: 6(9[0-9]|5[5-9])[0-9]{6}
  const regexOrange = /^6(9([0-9])|5([5-9]))[0-9]{6}$/;
  return regexOrange.test(formattedPhone);
}

/**
 * Check if phone number belongs to MTN network
 * MTN numbers: 67XX, 68XX, 50-54 (prefix 6 then 7, 8, or 5[0-4])
 */
export function isMTNPhoneNumber(phoneNumber: string): boolean {
  const formattedPhone = removeCallingCode(phoneNumber);
  if (!formattedPhone) return false;

  // MTN pattern: 6(7[0-9]|8[0-9]|5[0-4])[0-9]{6}
  const regexMTN = /^6(7([0-9])|(8|5)([0-4]))[0-9]{6}$/;
  return regexMTN.test(formattedPhone);
}










