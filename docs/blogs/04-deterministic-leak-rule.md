# Why a rule, not AI, decides when the tank is leaking

**Description:** The deterministic leak and heat logic behind TankSaathi: how we turn tank-level readings into hours of water left and a sustained-loss alert, and why we label every assumption.

**Tags:** aws-lambda, amazon-dynamodb, sustainability, serverless, hackathon

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour · Heat and Water track**

## The question a caretaker actually asks

A hostel caretaker doesn't want a graph. They want to know: "Will the tank last until the next supply?" And at 2 AM, they want to know if water is disappearing that shouldn't be. TankSaathi answers both with plain, deterministic TypeScript in a shared `core` package, covered by 124 unit tests and run inside AWS Lambda on every batch of readings.

## From distance to hours left

The sensor (a labelled simulator in our build) reports the distance from the top of the tank to the water, in millimetres. From that:

1. **Tank geometry** turns distance into litres, minus the water below the outlet that nobody can use.
2. **Outflow rate** comes from the drop in level over recent readings, ignoring refills.
3. **Hours remaining** divides usable litres by expected use, taken from an hourly demand profile for that kind of building.
4. **Heat adjustment:** on a forecast of 40 °C or more we plan for about 20% more use. On a 42 °C day, our demo tank's estimate drops from about 16 hours to about 13.

That 20% is an assumption, drawn from public evidence that water use rises in heat waves, not a measured fact. The app labels it as one, and ASSUMPTIONS.md lists the sources. Each building can change it.

## The sustained-loss rule

A leak looks like steady outflow at a time when the building should be quiet. Our rule checks the last three 15-minute windows (45 minutes). Every window must show loss well above what the profile expects for that hour:

- **Night (midnight to 5 AM):** more than 3× the expected use.
- **Daytime:** more than 2.5× the expected use.
- **And** at least 150 litres an hour above expected, so a tiny baseline can't trip it.

Missing data never counts as a loss, and refill periods are left out of the rate, because use during a refill can't be observed. When all three windows agree, the ingest Lambda opens exactly one incident in a DynamoDB transaction and hands it to Step Functions.

In our demo, a stuck float valve loses about 220 litres an hour from 1 AM. After 45 minutes the rule fires once, with the tank at 20% and about three hours left. The app's chart shows the reason: night hours using more than three times the normal amount.

## Why not let AI decide?

- **It has to be explainable.** A caretaker should see why the alert fired: the numbers, the window, the threshold.
- **It has to be testable.** Our tests check that 45 minutes of heavy night-time loss fires, that a shorter loss doesn't, that the normal morning peak and a refill aren't flagged, and that sparse data never decides. You can't pin a model's judgement down like that.
- **It has to be cheap and always on.** The rule runs in milliseconds in Lambda for every reading.

We did plan to use Amazon Bedrock for one thing: rewriting the explanation in friendlier English and Hindi. Bedrock was blocked on our new account ("Operation not allowed"), so it stays behind a switch and the app uses standard text. The decision itself never depended on it.

## Being honest about a hackathon build

We didn't have a real sensor or interviews with caretakers, so we said so: the readings come from a labelled simulator, the thresholds are configurable assumptions, and the Hindi needs a native speaker's review. The next step is a one-hostel pilot with an ESP32 and an ultrasonic sensor, then tuning the heat factor and night baseline from that building's own data.

## Links

- Code: https://github.com/navneet-cerecode/tanksaathi
- Live app: https://main.d1ko9f9uvcz4tc.amplifyapp.com
- Demo video: https://youtu.be/QbfelV5P3hA
