// 3 to 30 letters, digits, underscores or dashes, starting and ending with a letter or digit.
// The desktop identity manager enforces it; the profile form checks it first to explain why.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/i;
