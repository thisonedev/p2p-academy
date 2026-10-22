/**
 * Error codes that cross from the main process or the peer worker to the page.
 * `recoverable` is true when the same call can succeed later with nothing changed
 * on this device, so the page can offer a retry.
 */
export const ERROR_AREAS = ['ipc', 'peer', 'identity', 'lessons'] as const;
export type AcademyErrorArea = (typeof ERROR_AREAS)[number];

export interface AcademyErrorCodeInfo {
  area: AcademyErrorArea;
  recoverable: boolean;
}

export const ERROR_CODES = {
  IPC_UNTRUSTED_SENDER: { area: 'ipc', recoverable: false },
  IPC_INVALID_PAYLOAD: { area: 'ipc', recoverable: false },

  PEER_NOT_READY: { area: 'peer', recoverable: true },
  PEER_WORKER_EXITED: { area: 'peer', recoverable: true },
  PEER_RATE_LIMITED: { area: 'peer', recoverable: true },
  PEER_INVALID_COMMAND: { area: 'peer', recoverable: false },
  PEER_INVALID_INVITE: { area: 'peer', recoverable: false },
  PEER_DEVICE_OFFLINE: { area: 'peer', recoverable: true },
  PEER_RUN_IN_PROGRESS: { area: 'peer', recoverable: true },
  PEER_RUN_TOO_LARGE: { area: 'peer', recoverable: false },
  PEER_REMOTE_ERROR: { area: 'peer', recoverable: false },

  IDENTITY_ALREADY_EXISTS: { area: 'identity', recoverable: false },
  IDENTITY_NOT_READY: { area: 'identity', recoverable: false },
  IDENTITY_INVALID_MNEMONIC: { area: 'identity', recoverable: false },
  IDENTITY_INVALID_USERNAME: { area: 'identity', recoverable: false },
  IDENTITY_PROOF_FAILED: { area: 'identity', recoverable: false },
  IDENTITY_DEVICE_REVOKED: { area: 'identity', recoverable: false },
  IDENTITY_CANNOT_REVOKE_SELF: { area: 'identity', recoverable: false },
  IDENTITY_ATTEST_SESSION_UNKNOWN: { area: 'identity', recoverable: false },
  IDENTITY_ATTEST_SESSION_EXPIRED: { area: 'identity', recoverable: false },
  IDENTITY_KEYRING_UNAVAILABLE: { area: 'identity', recoverable: false },

  LESSON_BLOCKED_BY_DOWNLOAD: { area: 'lessons', recoverable: true },
  LESSON_RUNNING: { area: 'lessons', recoverable: true },
  LESSON_PEER_IDLE: { area: 'lessons', recoverable: true },
} as const satisfies Record<string, AcademyErrorCodeInfo>;

export type AcademyErrorCode = keyof typeof ERROR_CODES;

/** The cause of an error. `code` is absent when the cause has no code. */
export interface AcademyErrorCause {
  code?: string;
  message: string;
  cause?: AcademyErrorCause;
}

/** A coded failure as the page receives it. */
export interface AcademyErrorPayload {
  name: 'AcademyError';
  code: AcademyErrorCode;
  area: AcademyErrorArea;
  recoverable: boolean;
  message: string;
  cause?: AcademyErrorCause;
}

const MAX_CAUSE_DEPTH = 3;

export function isAcademyErrorCode(value: unknown): value is AcademyErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}

export function isAcademyError(value: unknown): value is AcademyErrorPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.name === 'AcademyError' && isAcademyErrorCode(v.code) && typeof v.message === 'string';
}

function toCause(value: unknown, depth: number): AcademyErrorCause | undefined {
  if (value == null || depth >= MAX_CAUSE_DEPTH) return undefined;
  const v = value as { code?: unknown; message?: unknown; cause?: unknown };
  const out: AcademyErrorCause = {
    message: typeof v.message === 'string' ? v.message : String(value),
  };
  if (typeof v.code === 'string') out.code = v.code;
  const next = toCause(v.cause, depth + 1);
  if (next) out.cause = next;
  return out;
}

/**
 * The payload for an error whose `code` is in ERROR_CODES, or null for any other
 * error. `area` and `recoverable` always come from the map, never from the error.
 */
export function toAcademyErrorPayload(err: unknown): AcademyErrorPayload | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { code?: unknown; message?: unknown; cause?: unknown };
  if (!isAcademyErrorCode(e.code)) return null;
  const info = ERROR_CODES[e.code];
  const payload: AcademyErrorPayload = {
    name: 'AcademyError',
    code: e.code,
    area: info.area,
    recoverable: info.recoverable,
    message: typeof e.message === 'string' ? e.message : e.code,
  };
  const cause = toCause(e.cause, 0);
  if (cause) payload.cause = cause;
  return payload;
}
