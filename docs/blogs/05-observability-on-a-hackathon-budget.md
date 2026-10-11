# Knowing it works: CloudWatch, a dead-letter queue and a $0 bill for TankSaathi

**Description:** How we made a serverless leak-alert app observable on a hackathon budget, with Powertools metrics, four CloudWatch alarms, one SQS dead-letter queue and AWS Budgets.

**Tags:** amazon-cloudwatch, amazon-sqs, aws-lambda, observability, hackathon

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour · Heat and Water track**

## An alert system that fails silently is worse than none

TankSaathi warns hostel caretakers when a rooftop tank is leaking or about to run dry. If a reading gets lost, or the workflow that emails the caretaker crashes, nobody gets warned and everyone assumes things are fine. So before polishing the UI, we asked one question: how would we know if something broke?

## Every failure lands in one queue

A reading passes through three hand-offs, and each can fail. We pointed every failure path at one Amazon SQS dead-letter queue:

- **AWS IoT Core → Lambda:** the IoT Rule's error action sends undeliverable messages to the queue.
- **Lambda's own retries:** the ingest function's on-failure destination is the same queue.
- **Amazon EventBridge → Step Functions:** the rule target has a dead-letter config pointing there too.

One queue means one place to look and one alarm to set. Nothing is dropped; at worst it waits in the queue for someone to replay it.

## Four alarms, each with a reason

We kept the list short, so every alarm means "someone should look now":

- `dlq-not-empty`: any message is visible in the dead-letter queue.
- `ingest-errors`: the ingest Lambda reports an error in a 5-minute window.
- `workflow-failed`: a Step Functions incident workflow fails.
- `api-5xx`: the HTTP API returns server errors.

Each alarm notifies an ops topic in Amazon SNS. During our final demo all four stayed OK.

## Custom metrics without extra API calls

We used **Powertools for AWS Lambda** (AWS open source) for logs and metrics. Its metrics use CloudWatch's embedded metric format: the numbers ride inside a structured log line, and CloudWatch turns them into metrics. No `PutMetricData` calls, no extra latency.

We record what matters to the product, not just to the code:

- `ReadingsAccepted`, `ReadingsRejected` and `TelemetryRejected` from ingest
- `IncidentsOpened`, plus acknowledgements and resolutions from the API
- `AuthorizationDenied`, whenever a Cedar policy says no
- `SimulatorRuns`, so demo traffic is visible and never mistaken for field data
- `ExplanationsStandard` or `ExplanationsFromBedrock`, which made it obvious that Bedrock was off on our account

A CloudWatch dashboard puts these next to the alarms, so a judge, or a future building manager, can see the system's health on one screen.

## Logs that help, and expire

Powertools writes JSON logs with the building, tank and incident IDs on every line, so one incident can be traced from the reading that triggered it to the email that went out. Every log group keeps 7 days of logs. That's enough to debug a demo, and it won't quietly cost money for years.

## Keeping the bill at zero

A hackathon account shouldn't surprise anyone. On day one we set up AWS Budgets with alerts at $3 forecast spend, and at $5 and $10 actual. Everything we use is pay-per-use: Lambda, DynamoDB on-demand, Step Functions Standard, the IoT Core message broker, SNS email and SQS. During the build, our budget showed $0.00 actual spend. TEARDOWN.md lists how to remove every resource afterwards.

## Takeaways

- Decide where failures go before you write the happy path.
- Fewer, meaningful alarms beat many noisy ones.
- Measure product events (incidents opened, acknowledged) as well as technical ones.
- Set a budget on day one.

## Links

- Code: https://github.com/navneet-cerecode/tanksaathi
- Live app: https://main.d1ko9f9uvcz4tc.amplifyapp.com
- Demo video: https://youtu.be/QbfelV5P3hA
