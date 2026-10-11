# Blog for AWS Builder Center

**Title:** TankSaathi: warning hostel caretakers before the rooftop tank runs dry

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour · Heat and Water track**

## Why a water tank?

Most Indian hostels and apartment blocks don't get water on tap all day. Municipal supply comes for a few hours, gets pumped up to a rooftop tank, and everyone draws from that tank until the next supply. The caretaker usually learns the tank is empty when residents start knocking. A stuck float valve or a running cistern can quietly waste thousands of litres overnight. And on a 42 °C day, the tank runs out sooner than anyone planned.

We wanted one plain answer for the caretaker, "about 13 hours of water left at today's use", and an alert while there's still time to act.

## What it does

- Turns tank-level readings into usable litres, current use and **hours remaining**, adjusted for the day's forecast heat.
- Watches for **sustained loss**: 45 minutes of outflow far above what the building normally uses at that hour, especially at night. A deterministic rule decides this, not AI.
- Opens exactly **one incident**, emails the caretaker, **escalates** if nobody responds, and records acknowledge → inspect → resolve on an audit timeline.
- Shows residents a plain **English/Hindi status** ("A possible leak is being checked. Please save water.") without litres or incident details.

## The stack

```
Sensor simulator --MQTT (X.509)--> AWS IoT Core --IoT Rule--> Lambda: ingest --> DynamoDB
                                                                   |
                                                    EventBridge (IncidentOpened)
                                                                   |
                         Step Functions: SNS email -> wait for caretaker -> escalate -> close
Browser --> Amplify Hosting --> Cognito --> API Gateway (JWT) --> Lambda: api (Cedar policies)
```

- **AWS IoT Core** receives MQTT readings. Each device has its own certificate, and the IoT policy reads the building and tank from the thing registry, so a certificate can only publish for its own tank.
- An **IoT Rule** invokes a **Lambda** that validates the batch, stores readings in **DynamoDB** (7-day TTL) and recomputes the tank's state with pure, unit-tested TypeScript.
- A leak opens one incident (a DynamoDB transaction holds a per-tank lock) and goes onto an **EventBridge** bus.
- **Step Functions** emails the caretaker through **SNS**, then waits on a task token. If nobody acknowledges within the building's limit, it escalates. The caretaker's Acknowledge and Resolve buttons resume the workflow.
- **Cognito** handles sign-in, and **API Gateway** checks the token. **Cedar** policies decide who can do what in which building.
- **SQS** catches failures, **CloudWatch** tracks custom metrics and four alarms, **AWS Budgets** watches cost, and **AWS SAM** defines all of it. **Powertools for AWS Lambda** gives us structured logs and metrics.

## What fought back

- **New-account limits.** CloudFront wanted account verification, Amplify allowed one app, and Bedrock returned "Operation not allowed". We kept the Bedrock integration behind a switch with templated fallback text, and only show what actually runs.
- **Readings arriving out of order.** IoT Rules invoke Lambda asynchronously, so a burst of messages can race. Sending a device's buffer as one ordered batch, and never letting an older computation overwrite newer state, fixed it.
- **A silent CORS drop.** Using `!If` inside the HTTP API's CORS settings made SAM drop the whole block without an error. A plain list fixed it.
- **Zips on Windows.** PowerShell's `Compress-Archive` writes backslash paths that Amplify won't serve. `tar -a` with explicit entries did the job.

## What we liked

Step Functions task tokens turned "wait for a human, escalate if nobody answers" into a few declarative states, and the execution history doubles as an audit log. DynamoDB conditional writes gave us "exactly one incident per leak" without locks in our code. And IoT Core policy variables made per-tank isolation one policy instead of one per device.

## Honest limits

Our readings come from a labelled simulator, not a real sensor. The heat factor and leak thresholds are assumptions we drew from public evidence and made configurable. The next step is a one-hostel pilot with an ESP32 and an ultrasonic sensor.

## Links

- Code: https://github.com/navneet-cerecode/tanksaathi
- Live app: https://main.d1ko9f9uvcz4tc.amplifyapp.com
