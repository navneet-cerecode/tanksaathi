# TankSaathi

**Heat-aware rooftop water-tank and leak early warning for shared buildings.**
Built by **Team NicobarAndaman** for Environmental Hacks (Bharat Builds Tour, Event 02) · Heat and Water track.

> TankSaathi tells a hostel caretaker how many hours of water the rooftop tank really has left on a hot day, and raises a leak alert while there is still time to act.

- **Live app:** https://main.d1ko9f9uvcz4tc.amplifyapp.com (sign-in required; demo accounts are shared with judges on request)
- **Region:** AWS ap-south-1 (Mumbai)
- **What's real and what's simulated:** see [Honesty notes](#honesty-notes) and [VERIFICATION.md](VERIFICATION.md)

## The problem

Indian hostels and apartment blocks store water in rooftop tanks because piped supply runs only a few hours a day (Bengaluru averages about 3 h). Caretakers usually find out the tank is empty when residents complain, and slow losses (a running cistern, a stuck float valve, an overflowing tank) go unnoticed for hours. Hot days make the tank empty sooner than usual. Sources and every assumption we made are in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## What it does

1. A tank-level sensor publishes readings over MQTT. **In this project the sensor is a clearly labelled simulator.**
2. TankSaathi turns readings into **usable litres, current use and hours remaining**, adjusted for the day's forecast heat (an explicit, configurable assumption).
3. A deterministic rule watches for **sustained loss**: 45 minutes of outflow far above what the building normally uses at that hour, especially at night.
4. When it fires, exactly one incident opens. A **Step Functions workflow emails the caretaker**, escalates if nobody acknowledges within the building's limit, and waits for the caretaker to **acknowledge → inspect → resolve** in the app.
5. Residents see a simple **English/Hindi status**: normal, use carefully, refill planned, or a possible leak being checked. They never see litres or incident details.

## Architecture

```
Sensor simulator ──MQTT/TLS (X.509)──▶ AWS IoT Core ──IoT Rule──▶ Lambda: ingest ──▶ DynamoDB
   (Lambda runner or CLI device)        per-thing policy           │  validate, dedupe, compute state
                                                                    │  open one incident (transaction)
                                                                    ▼
                                                     EventBridge (custom bus: IncidentOpened)
                                                                    ▼
                                    Step Functions: claim → SNS email → explain → wait for ack (task token)
                                    → escalate via SNS if ignored → wait for resolution → close → SNS email
Browser ──▶ Amplify Hosting (React app) ──▶ Cognito sign-in ──▶ API Gateway (JWT) ──▶ Lambda: api
                                                                       Cedar policy check on every request
Failures ──▶ SQS DLQ    ·   CloudWatch logs, metrics, alarms, dashboard   ·   AWS Budgets   ·   AWS SAM (IaC)
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## AWS services and what each one does

| Service / tool | Job in TankSaathi |
|---|---|
| **AWS IoT Core** | MQTT broker for tank telemetry; one X.509 identity per device; the policy pins each certificate to its own building's topic |
| **AWS Lambda** | Ingest (validate, store, compute), API, workflow helpers, explanations |
| **Amazon DynamoDB** | Readings (7-day TTL), tank state, incidents, audit timeline; conditional writes and transactions for idempotency |
| **Amazon EventBridge** | Custom bus that turns "incident opened" into a workflow start, with retries and a DLQ |
| **AWS Step Functions** | The incident lifecycle: notify, wait for a human with task tokens, escalate on timeout, close |
| **Amazon SNS** | Caretaker, escalation and ops emails |
| **Amazon SQS** | Dead-letter queue for failed telemetry deliveries, Lambda retries and EventBridge targets |
| **Amazon API Gateway** (HTTP API) | Authenticated API with Cognito JWT authorizer, throttling and CORS |
| **Amazon Cognito** | Sign-in; caretaker, resident and demo-operator groups; admin-set building attribute users can't change |
| **AWS Amplify Hosting** | Serves the web app over HTTPS with SPA rewrites and security headers |
| **Amazon CloudWatch** | Structured logs (7-day retention), custom metrics, four alarms, a dashboard |
| **AWS Budgets** | Cost alerts at $3 forecast, $5 and $10 actual |
| **AWS SAM** (open source) | All infrastructure as code in [backend/template.yaml](backend/template.yaml) |
| **Cedar** (AWS open source) | Authorization policies in [backend/src/auth/policies.cedar](backend/src/auth/policies.cedar), evaluated on every API call |
| **Powertools for AWS Lambda** (AWS open source) | Structured logging and embedded-metric-format metrics |
| Amazon Bedrock | Integrated behind a switch for plain-language EN/HI explanations. **Blocked on this new account** ("Operation not allowed"), so standard text is used; see VERIFICATION.md |

## Honesty notes

- **All tank readings come from a labelled sensor simulator.** There is no deployed physical sensor and no field validation. The message format matches what an ESP32 with an ultrasonic sensor would send.
- **The heat adjustment and leak thresholds are assumptions**, labelled in the app and listed in [ASSUMPTIONS.md](ASSUMPTIONS.md). We designed from public evidence; we did not interview caretakers.
- **Deterministic code decides** levels, hours remaining, leak detection, incidents and severity. Explanation text never decides anything.
- **Hindi text** needs review by a native speaker before any real use.

## Repository

```
packages/core   Deterministic logic shared by every part: tank maths, projection, leak rule, scenarios, notices
backend         AWS SAM template, Lambda handlers, Cedar policies, state machine, scripts
web             React + Vite + Tailwind app (shadcn/ui primitives restyled to DESIGN.md)
```

Design system: [DESIGN.md](DESIGN.md). Verification log: [VERIFICATION.md](VERIFICATION.md). Teardown: [TEARDOWN.md](TEARDOWN.md). Credits: [THIRD_PARTY.md](THIRD_PARTY.md).

## Running it

Requirements: Node 22+, AWS CLI v2 signed in, AWS SAM CLI, Docker (only for `sam local`).

```bash
npm install
npm test                      # 124 core + 63 backend unit tests
npm run typecheck

cd backend
cp .env.deploy.example .env.deploy   # set ALERT_EMAIL, IOT_DATA_ENDPOINT (and APP_URL after the first web deploy)
node scripts/deploy.mjs              # build Lambdas and sam deploy
npx tsx scripts/seed-demo.ts         # fictional demo buildings
bash scripts/provision-sim-device.sh # simulator X.509 certificate (git-ignored)
npx tsx scripts/create-demo-users.ts <UserPoolId>
npx tsx scripts/sim-publish.ts leak  # publish a scenario over MQTT
npx tsx scripts/api-smoke.ts         # end-to-end checks with real Cognito tokens
npx tsx scripts/check-topic-isolation.ts

cd ../web
node scripts/deploy-web.mjs          # build and deploy to Amplify Hosting
```

## AI tools used

Built with **Claude Code** (Anthropic) using these skills: Superpowers (test-driven development, planning), UI UX Pro Max (design-system research), Impeccable, Emil Kowalski's design-engineering skills, Ponytail, Vercel agent-skills (web design guidelines, React best practices) and the shadcn/ui skill. The team reviewed the decisions; every behaviour is covered by tests or by the live smoke tests.

## Licence

MIT. See [LICENSE](LICENSE). Third-party credits in [THIRD_PARTY.md](THIRD_PARTY.md).
