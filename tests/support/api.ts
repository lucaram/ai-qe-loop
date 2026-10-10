import type { APIRequestContext, TestInfo } from '@playwright/test';
import { assertMatchesContract } from './contract';

export const DEFAULT_PASSWORD = 'Correct-Pass-1';

export interface ApiResponse { status: number; body: Record<string, unknown> }
export interface AccountSetup { password?: string; failedAttempts?: number; lockedForMs?: number | null }
export interface AccountState { failedAttempts: number; lockedUntil: number | null; locked: boolean }

// One account per test (and per repeat) so parallel and repeated runs never share state.
export function uniqueUsername(testInfo: TestInfo): string {
  return `user-${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
}

export async function login(request: APIRequestContext, username: string, password: string): Promise<ApiResponse> {
  const response = await request.post('/auth/login', { data: { username, password } });
  const body = await response.json();
  assertMatchesContract('POST', '/auth/login', response.status(), body);
  return { status: response.status(), body };
}

export async function setAccount(request: APIRequestContext, username: string, setup: AccountSetup = {}): Promise<AccountState> {
  const response = await request.put(`/test/accounts/${encodeURIComponent(username)}`, { data: setup });
  if (!response.ok()) throw new Error(`Test hook failed: ${response.status()}`);
  return response.json();
}

export async function getAccount(request: APIRequestContext, username: string): Promise<AccountState> {
  const response = await request.get(`/test/accounts/${encodeURIComponent(username)}`);
  if (!response.ok()) throw new Error(`Test hook failed: ${response.status()}`);
  return response.json();
}
