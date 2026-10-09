# Demo video script (target 2:50, hard limit under 3:00)

**Record between 10:00 and 16:00 IST.** The simulator's leak story starts at 01:00, so by then the tank still has several hours of water when the alert opens. After 18:00 it is nearly empty.

## Before recording

1. Sign in as the **operator** in one browser window (caretaker screens + Simulator tab) and as the **resident** in a second window (phone size).
2. Simulator tab → **Reset demo**, wait 20 s → **Normal day**.
3. Open in tabs: Step Functions console (state machine `tanksaathi-dev-incident`), DynamoDB table `tanksaathi-dev`, CloudWatch dashboard `TankSaathi-dev`, the caretaker inbox, IoT Core → MQTT test client subscribed to `tanksaathi/v1/#`.
4. Close notifications; zoom the browser to 110%.

## Shot list

| Time | Screen | Do | Say (gist) |
|---|---|---|---|
| 0:00–0:20 | Title card, then a photo of your own building's rooftop tank | — | "Hostels and apartments run on rooftop tanks. Caretakers find out they're empty when residents complain, and slow leaks waste water for hours." |
| 0:20–0:45 | Caretaker overview (Normal) | Point at the hours figure, gauge and freshness stamp | "TankSaathi turns tank readings into one answer: about 17 hours of water left at today's use. The readings come from our labelled sensor simulator." |
| 0:45–1:10 | Simulator → **Heat day**, back to Overview; MQTT test client | Run, show messages arriving, show hours drop and the heat note | "A 42 °C forecast: we assume about 20% more use. That's an assumption we label in the app, so the estimate drops to about 13 hours." |
| 1:10–1:40 | Simulator → **Reset**, wait 20 s → **Sustained leak**; Overview, then Tank tab | Show the incident strip, then the hourly chart's flagged night hours | "From 1 AM a stuck float valve loses about 220 litres an hour while the building sleeps. For 45 minutes that's three times normal, so TankSaathi opens one alert." |
| 1:40–2:05 | Inbox → Step Functions graph → DynamoDB incident item → CloudWatch dashboard | Show the email, the workflow paused at *WaitForAcknowledgement*, the item, the metrics | "That's a real AWS workflow: EventBridge started Step Functions, SNS sent this email, and it's now waiting for a human. If nobody responds in two minutes, it escalates." |
| 2:05–2:30 | Incident screen; resident window | **Acknowledge alert** → **Start inspection** → **Mark as resolved** (leak fixed); show the resident view change, toggle Hindi | "The caretaker acknowledges, inspects and resolves. Every step is audited. Residents only see a plain status, in English or Hindi." |
| 2:30–2:50 | Architecture slide | — | "IoT Core, Lambda, DynamoDB, EventBridge, Step Functions, SNS, SQS, API Gateway, Cognito, Amplify, CloudWatch, Budgets, all in SAM, with Cedar and Powertools from AWS open source." |
| 2:50–3:00 | Closing card | — | "TankSaathi helps shared buildings act before water is wasted or residents unexpectedly lose supply. Team NicobarAndaman." |

## Rules for the recording

- Never call the simulator a real sensor. Keep the "Sensor simulator" ribbon visible.
- Don't show Bedrock as working. If asked, say it's integrated but blocked on our new account.
- Upload to YouTube as **unlisted**; open the link in a signed-out browser before submitting.
