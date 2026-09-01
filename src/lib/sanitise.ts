/** Strip HTML tags and control characters from user-submitted text. */
export function sanitiseText(input: string, maxLen = 500): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
export const PINCODE = /^\d{6}$/;
