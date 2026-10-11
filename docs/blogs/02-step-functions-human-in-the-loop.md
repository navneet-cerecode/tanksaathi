# Waiting for a human: Step Functions task tokens for leak alerts

**Description:** How TankSaathi uses AWS Step Functions task tokens to email a caretaker, pause until they respond, and escalate if nobody does, with no timers or polling code.

**Tags:** aws-step-functions, amazon-eventbridge, amazon-sns, serverless, hackathon

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour · Heat and Water track**

## The problem with alerts

When TankSaathi spots a leak in a hostel's rooftop tank, sending an email is the easy part. The hard part is what comes after. Did the caretaker see it? Are they on their way? What if they're asleep? A leak losing 220 litres an hour can't wait until morning, but we also didn't want to write a scheduler, a retry table and a cron job to track who has replied.

AWS Step Functions turned out to fit this exactly.

## One workflow per incident

When the ingest Lambda opens an incident, it puts an `IncidentOpened` event on an Amazon EventBridge custom bus. A rule starts one Standard workflow per incident:

```
ClaimIncident -> NotifyCaretaker (SNS) -> Explain
  -> WaitForAcknowledgement --timeout--> Escalate (SNS) -> WaitForAcknowledgementAfterEscalation
  -> WaitForResolution -> CloseIncident -> NotifyResolved (SNS)
```

## Pausing on a task token

The waiting states use the `.waitForTaskToken` integration. Step Functions hands a small Lambda a token, the Lambda stores it on the incident in DynamoDB, and the workflow simply stops there. It costs nothing while it waits.

```json
"WaitForAcknowledgement": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
  "TimeoutSecondsPath": "$.detail.escalateAfterSeconds",
  "Catch": [{ "ErrorEquals": ["States.Timeout"], "Next": "Escalate" }],
  "Next": "WaitForResolution"
}
```

When the caretaker taps **Acknowledge** in the app, our API Lambda reads the stored token and calls `SendTaskSuccess`. The workflow wakes up and moves on to waiting for resolution. **Resolve** works the same way.

The escalation rule is a single line. `TimeoutSecondsPath` reads each building's own limit from the event, so a hostel can say "escalate after 30 minutes" and our demo building says two. If the timer runs out first, the `States.Timeout` catch sends the escalation email through Amazon SNS and waits again.

## Duplicate deliveries

EventBridge delivers at least once, so the same incident could start two workflows. The first state guards against that with a DynamoDB conditional write:

```
ConditionExpression: attribute_exists(PK) AND attribute_not_exists(workflowExecution)
```

Only the first execution records itself on the incident; the second hits `ConditionalCheckFailedException` and ends quietly in an `AlreadyHandled` state. The caretaker gets one email, not two.

## The audit log for free

Every execution keeps its full history: when the incident was claimed, when the email went out, how long it waited, and when the caretaker acknowledged and resolved it. In our demo run the caretaker was emailed at 16:35:22, acknowledged at 16:36:41 and resolved at 16:37:49. That's exactly the trail a building manager wants after an incident, and we didn't write a line of logging code for it.

## What we'd tell other teams

- Use a **Standard** workflow when a human is involved. Express workflows can't wait for hours.
- Keep the token in your own table, keyed by the incident, so the API can find it without searching executions.
- Give every wait a timeout. Ours escalate, and the final waits fail after 6 and 24 hours, so nothing hangs forever.

## Links

- Code: https://github.com/navneet-cerecode/tanksaathi
- Live app: https://main.d1ko9f9uvcz4tc.amplifyapp.com
- Demo video: https://youtu.be/QbfelV5P3hA
