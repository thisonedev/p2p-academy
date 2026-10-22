// 3 to 30 letters, digits, underscores or dashes, starting and ending with a letter or digit.
// The desktop identity manager enforces it; the profile form checks it first to explain why.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/i;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** The message for a username that USERNAME_RE refuses, or null when it is valid. Pass it trimmed. */
export function usernameError(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_RE.test(username)) {
    return 'Letters, digits, dashes, and underscores only. No leading or trailing dash or underscore.';
  }
  return null;
}
