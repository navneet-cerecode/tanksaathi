# Blog draft for AWS Builder Center

**Title:** TankSaathi: warning hostel caretakers before the rooftop tank runs dry

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour**

## Why a water tank?

Most Indian hostels and apartment blocks don't get water on tap all day. Municipal supply comes for a few hours, gets pumped up to a rooftop tank, and everyone draws from that tank until the next supply. The caretaker usually learns the tank is empty when residents start knocking. A stuck float valve or a running cistern can quietly waste thousands of litres overnight. And on a 42 °C day, the tank runs out sooner than anyone planned.

We wanted one plain answer for the caretaker, "about 4 hours of water left at today's use", and an alert while there's still time to act.

## The stack

_Add the architecture diagram from docs/ARCHITECTURE.md._

- **AWS IoT Core** receives MQTT readings. Each device has its own certificate, and the IoT policy reads the building and tank from the thing registry, so a certificate can only publish for its own tank.
- An **IoT Rule** invokes a **Lambda** that validates the batch, stores readings in **DynamoDB** (7-day TTL) and recomputes the tank's state with pure, unit-tested TypeScript.
- A leak opens one incident (a DynamoDB transaction holds a per-tank lock) and goes onto an **EventBridge** bus.
- **Step Functions** emails the caretaker through **SNS**, then waits on a task token. If nobody acknowledges within the building's limit, it escalates. The caretaker's Acknowledge and Resolve buttons resume the workflow.
- **Cognito** handles sign-in, and **API Gateway** checks the token. **Cedar** policies decide who can do what in which building.
- **SQS** catches failures, **CloudWatch** alarms on them, and **SAM** defines all of it.

## What fought back

- **New-account limits.** CloudFront wanted account verification, Amplify allowed one app, and Bedrock returned "Operation not allowed". We kept the Bedrock integration behind a switch with templated fallback text, and only show what actually runs.
- **Readings arriving out of order.** IoT Rules invoke Lambda asynchronously, so a burst of messages can race. Sending a device's buffer as one ordered batch, and never letting an older computation overwrite newer state, fixed it.
- **Zips on Windows.** PowerShell's `Compress-Archive` writes backslash paths that Amplify won't serve. `tar -a` with explicit entries did the job.

## Honest limits

Our readings come from a labelled simulator, not a real sensor. The heat factor and leak thresholds are assumptions we drew from public evidence and made configurable. The next step is a one-hostel pilot with an ESP32 and an ultrasonic sensor.

_Link the repo and video. Publish on AWS Builder Center before submitting, and link it in the submission form._
