import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attemptLogin, type AccountStore } from './auth';
import { registerTestHooks } from './test-hooks';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp(store: AccountStore, options: { testHooks: boolean; now?: () => number }) {
  const now = options.now ?? Date.now;
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ADR-0002: the Auth Service decides the lock; the UI only shows the message.
  app.post('/auth/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ message: 'Username and password are required.' });
      return;
    }
    const result = attemptLogin(store, username, password, now());
    res.status(result.status).json(result.body);
  });

  if (options.testHooks) registerTestHooks(app, store, now);

  app.use(express.static(publicDir));
  return app;
}
