import { randomUUID } from 'node:crypto';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
export const LOCKED_MESSAGE = 'Your account is locked. Try again in 15 minutes.';
export const WRONG_CREDENTIALS_MESSAGE = 'Wrong username or password.';

export interface Account {
  password: string;
  failedAttempts: number;
  lockedUntil: number | null;
}

export type AccountStore = Map<string, Account>;

export type LoginResult =
  | { status: 200; body: { token: string } }
  | { status: 401 | 423; body: { message: string } };

const wrongCredentials = (): LoginResult => ({ status: 401, body: { message: WRONG_CREDENTIALS_MESSAGE } });
const locked = (): LoginResult => ({ status: 423, body: { message: LOCKED_MESSAGE } });

// State as the outside world sees it: a lock that has ended counts as no lock and 0 attempts.
export function effectiveState(account: Account, now: number) {
  if (account.lockedUntil !== null && now >= account.lockedUntil) {
    return { failedAttempts: 0, lockedUntil: null, locked: false };
  }
  return {
    failedAttempts: account.failedAttempts,
    lockedUntil: account.lockedUntil,
    locked: account.lockedUntil !== null,
  };
}

export function attemptLogin(store: AccountStore, username: string, password: string, now: number): LoginResult {
  const account = store.get(username);
  if (!account) return wrongCredentials();

  if (account.lockedUntil !== null) {
    if (now < account.lockedUntil) return locked();
    account.lockedUntil = null;
    account.failedAttempts = 0;
  }

  if (password === account.password) {
    account.failedAttempts = 0;
    return { status: 200, body: { token: randomUUID() } };
  }

  account.failedAttempts += 1;
  if (account.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    account.lockedUntil = now + LOCK_DURATION_MS;
    return locked();
  }
  return wrongCredentials();
}
