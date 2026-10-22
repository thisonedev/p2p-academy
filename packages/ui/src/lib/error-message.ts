import { isAcademyError } from '@academy/validation/errors';

/**
 * The text to show for a caught error. A coded failure from `window.academy` rejects
 * with a plain AcademyErrorPayload object, not an Error, so check for it first.
 */
export function errorMessage(err: unknown, fallback?: string): string {
  if (isAcademyError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return fallback ?? String(err);
}
