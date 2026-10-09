# Verification log

Levels: **1** unit verified · **2** locally integrated · **3** AWS deployed · **4** real AWS request observed · **5** browser end-to-end verified · **6** demo-video verified · **7** not verified · **8** blocked.

Only capabilities at level 4 or higher appear in the demo video as working.

| Capability | Level | Evidence |
|---|---|---|
| Tank maths, outflow rate, heat bands, projection, leak rule, scenarios, notices, explanations | 1 | 124 Vitest tests in `packages/core` |
| Ingest rules, idempotent incident opening, Cedar policy matrix, incident actions, views, explanation fallback | 1 | 63 Vitest tests in `backend` |
| MQTT telemetry: simulator certificate → IoT Core → IoT Rule → Lambda → DynamoDB | 4 | 85-reading batch stored; structured log line with X-Ray trace id (2026-10-08) |
| IoT policy blocks other buildings' topics and the device channel | 4 | `scripts/check-topic-isolation.ts`: both publishes denied; Block B received 0 readings |
| Sustained-loss detection on ingest | 4 | Leak scenario detected at 01:50 IST, about 220 L/h above expected |
| One incident per leak → EventBridge → Step Functions | 4 | Exactly one incident; execution started and claimed it |
| SNS caretaker email | 4 | Publish succeeded in the execution history; subscriptions confirmed by the team |
| Escalation when nobody acknowledges | 4 | Execution timed out after exactly 2 min and published the escalation |
| Cognito sign-in, groups and building attribute | 4 | `scripts/api-smoke.ts` signs in four accounts |
| Cedar authorization on every API call | 4 | Smoke test: residents, other buildings and non-operators denied (9 boundary checks) |
| Acknowledge → inspect → resolve resumes the workflow | 4 | Smoke test: both task tokens resumed; execution SUCCEEDED; timeline recorded |
| Explanation step (standard EN/HI text) | 4 | Smoke test: incident carries a Hindi + English explanation |
| Demo simulator via API (IoT Core publish), rate limit, reset | 4 | Smoke test: run accepted, second run 429, reset stopped running workflows |
| Web app on Amplify Hosting | 4 | Index, assets (`text/css`) and email deep links return 200; HSTS, X-Frame-Options, nosniff headers present |
| Sign-in screen: layout, validation, labels | 5 | Checked at 360, 390, 768, 1280 and 1440 px wide: no horizontal scroll, 48 px controls, linked error message |
| Caretaker, resident, incident and simulator screens in the browser | 7 | Data paths verified through the API; the in-browser click-through needs a team member to sign in |
| CloudWatch dashboard and four alarms | 3 | Deployed; alarms haven't fired |
| AWS Budgets | 4 | Budget reads $0.00 actual spend |
| Amazon Bedrock explanations | 8 | Account-level "Operation not allowed" on every model and region tried (new-account restriction). Code and IAM are in place behind `BedrockEnabled=false` |
| CloudFront hosting | 8 | "Your account must be verified before you can add new CloudFront resources." Amplify Hosting used instead |
| Hindi copy | 7 | Needs native-speaker review |
| Demo video | 7 | Not recorded yet |
