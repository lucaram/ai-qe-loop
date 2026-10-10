import type { Express } from 'express';
import { effectiveState, type Account, type AccountStore } from './auth';

export const DEFAULT_TEST_PASSWORD = 'Correct-Pass-1';

interface AccountSetup {
  password?: string;
  failedAttempts?: number;
  lockedForMs?: number | null;
}

// ADR-0001: tests set up locked accounts by writing the stored fields, instead of waiting 15 minutes.
export function registerTestHooks(app: Express, store: AccountStore, now: () => number): void {
  app.put('/test/accounts/:username', (req, res) => {
    const setup = (req.body ?? {}) as AccountSetup;
    const existing: Account = store.get(req.params.username)
      ?? { password: DEFAULT_TEST_PASSWORD, failedAttempts: 0, lockedUntil: null };
    const account: Account = {
      password: setup.password ?? existing.password,
      failedAttempts: setup.failedAttempts ?? existing.failedAttempts,
      lockedUntil: setup.lockedForMs === undefined
        ? existing.lockedUntil
        : setup.lockedForMs === null ? null : now() + setup.lockedForMs,
    };
    store.set(req.params.username, account);
    res.json(effectiveState(account, now()));
  });

  app.get('/test/accounts/:username', (req, res) => {
    const account = store.get(req.params.username);
    if (!account) {
      res.status(404).json({ message: 'No such account.' });
      return;
    }
    res.json(effectiveState(account, now()));
  });
}
