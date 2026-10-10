# PROJ-130: Lock the account after 5 failed login attempts

Sources: context/manifest.json pulled_at 2026-10-10T23:05:20.557Z
Business rules: BR-001, BR-002
Seed: tests/seed.spec.ts

Constants: LOCKED = "Your account is locked. Try again in 15 minutes."; WRONG = "Wrong username or password."; default fixture password = "Correct-Pass-1". The Auth Service is tagged risk:high.
Account names below (lock1, c2, ui13, …) are for reading only: every test uses its own fresh account (`uniqueUsername(testInfo)`), so scenarios are independent.

## API scenarios
Lock rules are tested at API level. Use POST /auth/login {username, password}, set up state with PUT /test/accounts/:username, and read state with GET /test/accounts/:username.

### 1. Five wrong passwords lock the account [PROJ-130][AC-1][BR-001]
Setup: PUT /test/accounts/lock1 {} (active account, failedAttempts 0, no lock).
Steps:
1. POST /auth/login {lock1, "Wrong-1"}, repeated for attempts 1 to 4.
2. After each of attempts 1 to 4, GET /test/accounts/lock1.
3. POST the 5th wrong password.
4. GET /test/accounts/lock1.
Expected:
- Attempts 1 to 4 return 401 {"message":"Wrong username or password."}. The GET results show failedAttempts 1, 2, 3, 4 and locked false.
- The 5th returns 423 {"message":"Your account is locked. Try again in 15 minutes."}.
- The final GET shows locked true and lockedUntil about 15 minutes from now.

### 2. Four wrong passwords do not lock the account (boundary) [PROJ-130][BR-001]
Setup: PUT /test/accounts/lock2 {}.
Steps:
1. Send 4 wrong passwords.
2. GET /test/accounts/lock2.
3. POST the correct password "Correct-Pass-1".
Expected:
- All 4 wrong attempts return 401 with "Wrong username or password.".
- The GET shows failedAttempts 4 and locked false.
- The correct password returns 200 {token}.

### 3. Correct password while locked is refused (correct-password-while-locked) [PROJ-130][AC-2][BR-001]
Setup: PUT /test/accounts/lock3 {failedAttempts:5, lockedForMs:600000}.
Steps:
1. POST /auth/login {lock3, "Correct-Pass-1"}.
2. GET /test/accounts/lock3.
Expected:
- The login returns 423 {"message":"Your account is locked. Try again in 15 minutes."} with no token.
- The GET shows locked true.

### 4. Correct password with 4 failed attempts succeeds and resets the count [PROJ-130][AC-3][BR-002]
Setup: PUT /test/accounts/reset4 {failedAttempts:4, lockedForMs:null}.
Steps:
1. POST /auth/login {reset4, "Correct-Pass-1"}.
2. GET /test/accounts/reset4.
Expected:
- The login returns 200 {token}.
- The GET shows failedAttempts 0 and locked false.

### 5. Login allowed once 15 minutes have passed [PROJ-130][AC-4][BR-001]
Setup: PUT /test/accounts/expire5 {failedAttempts:5, lockedForMs:0} (the lock ends right now, "15:00").
Steps:
1. POST /auth/login {expire5, "Correct-Pass-1"}.
2. GET /test/accounts/expire5.
Expected:
- The login returns 200 {token}.
- The GET shows locked false and failedAttempts 0.

### 6. 5th wrong password and a wrong password on a locked account both return 423 (clarification 1) [PROJ-130][BR-001]
Setup: PUT /test/accounts/c1 {failedAttempts:4, lockedForMs:null}.
Steps:
1. POST a wrong password (this is the 5th).
2. POST another wrong password on the now-locked account.
Expected:
- Both responses are 423 {"message":"Your account is locked. Try again in 15 minutes."}.

### 7. Wrong password during a lock changes nothing (clarification 2) [PROJ-130][BR-001]
Setup: PUT /test/accounts/c2 {failedAttempts:5, lockedForMs:300000}. Then GET /test/accounts/c2 and record lockedUntil (L).
Steps:
1. POST a wrong password 3 times.
2. GET /test/accounts/c2.
Expected:
- Each POST returns 423 with the locked message.
- The GET shows failedAttempts 5, lockedUntil equal to L (not extended or reset), and locked true.

### 8. Failed-attempt count is 0 when the lock ends (clarification 3) [PROJ-130][BR-001]
Setup: PUT /test/accounts/c3 {failedAttempts:5, lockedForMs:0}.
Steps:
1. GET /test/accounts/c3.
2. POST one wrong password.
3. GET /test/accounts/c3.
Expected:
- The first GET shows locked false and failedAttempts 0.
- The wrong password returns 401 "Wrong username or password.".
- The final GET shows failedAttempts 1 (counting restarted from 0, not 6) and locked false.

### 9. Unknown username returns 401 and affects no account (clarification 4) [PROJ-130]
Setup: PUT /test/accounts/real9 {failedAttempts:2}. Use a username "ghost9" that was never created.
Steps:
1. POST /auth/login {ghost9, "anything"} 6 times.
2. GET /test/accounts/real9.
3. POST /auth/login {real9, "Correct-Pass-1"}.
Expected:
- Every unknown-user response is 401 {"message":"Wrong username or password."}, never 423.
- real9 still shows failedAttempts 2 and locked false.
- The real9 login returns 200.

### 10. At 14:59 login is still refused (lock-ends-too-early, clarification 3) [PROJ-130][BR-001]
Setup: PUT /test/accounts/early10 {failedAttempts:5, lockedForMs:1000} (one second left of the lock). Send the login straight after the setup.
Steps:
1. POST the correct password.
2. GET /test/accounts/early10.
Expected:
- The login returns 423 with the locked message.
- The GET shows locked true.

### 11. At exactly 15:00 login is allowed (boundary, clarification 3) [PROJ-130][BR-001]
Setup: PUT /test/accounts/exact11 {failedAttempts:5, lockedForMs:0}.
Steps:
1. POST the correct password.
Expected:
- The login returns 200 {token}, not 423.
- With scenario 10, this pins the boundary between refused (one second left) and allowed (lock ended).

### 12. Count is not left over after a successful login (count-not-reset-after-success) [PROJ-130][BR-002]
Setup: PUT /test/accounts/stale12 {failedAttempts:4, lockedForMs:null}.
Steps:
1. POST the correct password.
2. GET /test/accounts/stale12.
3. POST 4 wrong passwords.
4. GET /test/accounts/stale12.
5. POST a 5th wrong password.
Expected:
- Step 1 returns 200 and step 2 shows failedAttempts 0.
- The 4 wrong passwords all return 401; step 4 shows failedAttempts 4 and locked false.
- The 5th wrong password returns 423 with the locked message.

## UI scenarios
Each UI scenario sets up the account through PUT /test/accounts/:username first. UI tests only check that the message from the API is displayed (ADR-0002). The login page has a "Sign in" heading, Username and Password fields, a "Sign in" button, and an element with role "alert".

### 13. Locked message shown on the login page after the 5th wrong password [PROJ-130][AC-1][BR-001]
Setup: PUT /test/accounts/ui13 {failedAttempts:4}.
Steps:
1. Open the login page.
2. Enter Username ui13 and a wrong password, then click "Sign in".
Expected:
- The alert shows "Your account is locked. Try again in 15 minutes.".

### 14. Locked message shown when a locked account signs in with the correct password [PROJ-130][AC-2][BR-001]
Setup: PUT /test/accounts/ui14 {failedAttempts:5, lockedForMs:600000}.
Steps:
1. Open the login page.
2. Enter ui14 and "Correct-Pass-1", then click "Sign in".
Expected:
- The alert shows "Your account is locked. Try again in 15 minutes.".

### 15. Wrong-credentials message shown for a wrong password [PROJ-130]
Setup: PUT /test/accounts/ui15 {}.
Steps:
1. Open the login page.
2. Enter ui15 and a wrong password, then click "Sign in".
Expected:
- The alert shows "Wrong username or password.".

## Coverage

| Source item | Scenarios |
|---|---|
| AC-1 | 1, 13 |
| AC-2 | 3, 14 |
| AC-3 | 4 |
| AC-4 | 5 |
| Clarification 1 (423 on 5th and while locked) | 6 |
| Clarification 2 (wrong password during lock changes nothing) | 7 |
| Clarification 3 (count 0 after lock; 14:59 vs 15:00) | 8, 10, 11 |
| Clarification 4 (unknown username) | 9 |
| BR-001 correct-password-while-locked | 3 |
| BR-001 lock-ends-too-early | 10 |
| BR-002 count-not-reset-after-success | 12 |
| Boundary 4 vs 5 attempts | 1, 2 |
