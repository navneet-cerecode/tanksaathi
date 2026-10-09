# Submission writeup (draft)

**Project:** TankSaathi · **Team:** NicobarAndaman · **Track:** Heat and Water
**Repo:** https://github.com/navneet-cerecode/tanksaathi · **Live:** https://main.d1ko9f9uvcz4tc.amplifyapp.com · **Video:** _add YouTube link_

## The problem

Shared buildings in Indian cities run on rooftop tanks because piped water arrives for only a few hours a day; Bengaluru's population-weighted average is about 3 hours. When a tank runs dry, the caretaker usually learns it from residents. Slow losses from a running cistern, a stuck float valve or an overflowing tank waste thousands of litres before anyone notices; water boards in Bengaluru and Hyderabad now fine buildings for overflow. On hot days the tank empties sooner than the caretaker expects.

## What we built

TankSaathi turns tank-level readings into one plain answer, **"about 4 hours of water left at today's use"**, adjusted for the day's forecast heat. A deterministic rule watches for **45 minutes of loss far above what the building normally uses at that hour**, especially at night when almost nobody should be drawing water. When it fires, TankSaathi opens one incident, emails the caretaker, escalates if nobody responds, and walks the caretaker through acknowledge → inspect → resolve. Residents see a simple English/Hindi status without any operational detail.

## Where AWS fits

- **AWS IoT Core** receives MQTT telemetry; each device's certificate can publish only to its own tank's topic.
- An **IoT Rule** invokes the ingest **Lambda**, which validates, de-duplicates and stores readings in **DynamoDB**, recomputes the tank state and opens at most one incident in a transaction.
- The incident goes onto an **EventBridge** custom bus, which starts a **Step Functions** workflow. The workflow emails the caretaker through **SNS**, attaches an English/Hindi explanation, then pauses on a task token until the caretaker acknowledges. It escalates if nobody does, and pauses again until the incident is resolved.
- The React app is served by **Amplify Hosting**. Users sign in with **Cognito**, and **API Gateway** checks their token. Every request is authorized by **Cedar** policies, so caretakers act only in their own building and residents see only a status.
- Failures land in an **SQS** dead-letter queue. **CloudWatch** holds structured logs, custom metrics, four alarms and a dashboard. **AWS Budgets** watches cost.
- Everything is defined in **AWS SAM**. We also use **Powertools for AWS Lambda**, so the build uses three AWS open-source tools: SAM, Cedar and Powertools.

## What is simulated, and what is assumed

- All tank readings come from a **labelled sensor simulator** that sends the same MQTT messages a real ESP32 + ultrasonic sensor would. There's no physical sensor and no field validation.
- The **heat multiplier**, **night quiet window** and **leak thresholds** are assumptions drawn from public evidence, configurable per building and listed in ASSUMPTIONS.md. We did not interview caretakers.
- **Amazon Bedrock** is integrated but switched off: our new AWS account returns "Operation not allowed" for Bedrock, so explanations use standard templated text. We show only what we verified (VERIFICATION.md).

## AI tools used

Claude Code (Anthropic), with the Superpowers, UI UX Pro Max, Impeccable, Emil Kowalski, Ponytail, Vercel agent-skills and shadcn/ui skills.

## What's next

A real ESP32 sensor pilot in one hostel; calibrating the heat factor and night baseline from that building's own data; WhatsApp/SMS alerts after TRAI DLT registration; overflow alerts during refills.
