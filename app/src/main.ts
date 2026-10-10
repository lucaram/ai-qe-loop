import { createApp } from './server';

const port = Number(process.env.PORT ?? 3000);
const testHooks = process.env.TEST_HOOKS === '1';

createApp(new Map(), { testHooks }).listen(port, () => {
  console.log(`Auth app on http://localhost:${port}${testHooks ? ' (test hooks on)' : ''}`);
});
