# Assumptions register

TankSaathi was designed from public evidence during a four-day hackathon. **We did not interview caretakers or test with real tanks.** Every number below is a configurable setting, not a validated fact, and the app labels it where it affects what users see.

| # | Assumption | Default | Where it is used | Public evidence we leaned on | What would validate it |
|---|---|---|---|---|---|
| A1 | Shared buildings rely on rooftop storage because piped supply is intermittent | — | Problem framing | Bengaluru population-weighted supply ≈ 3.0 h/day and Delhi ≈ 4.3 h/day; Bengaluru residents need ≈ 45 h of storage ([India Water Portal](https://www.indiawaterportal.org/health-and-sanitation/urban-sanitation/intermittent-water-distribution-networks-tale-two-cities)) | Building surveys |
| A2 | Caretakers learn about empty tanks late, often from residents | — | Product value | 2024: Bengaluru apartment complexes warned residents their tank water "might only last for one hour" ([AP via VOA](https://www.voanews.com/a/india-bengaluru-running-out-of-water-as-summer-looms/7531387.html)) | Caretaker interviews |
| A3 | Hot days raise building water use | +10% from 35 °C, +20% from 40 °C, +30% from 44 °C | Heat-adjusted projection | Household use varies significantly from the 135 LPCD benchmark in summer (Bandari & Sadhukhan, *Utilities Policy*, 2025, [RePEc](https://ideas.repec.org/a/eee/juipol/v96y2025ics0957178725001328.html)). The 40 °C step follows IMD's plains heatwave threshold. **The multipliers themselves are placeholders.** | A season of metered data from one building |
| A4 | Almost nobody draws water 00:00–05:00, so sustained loss then signals a leak or an open tap | Quiet window 00–05; flag at 3× expected and ≥150 L/h above it, for 3 consecutive 15-min windows | Leak detection | Minimum night flow is a standard leak indicator in utility practice | Night-time readings from hostels (students may be awake) |
| A5 | Tank overflow and leaks waste enough water to matter | — | Problem framing | Bengaluru's water board moved to mandate automatic level controllers against overhead-tank overflow ([Deccan Herald](https://www.deccanherald.com/india/karnataka/bengaluru/bwssb-targets-overhead-tank-water-wastage-in-new-move-773145.html)); Hyderabad fined an apartment ₹10,000 for spillage ([Siasat](https://www.siasat.com/banjara-hills-apartment-fined-rs-10k-over-spilling-water-on-street-3481512/)) | Building audits |
| A6 | Daily demand ≈ residents × 90 L | Demo: 80 residents → 7,200 L/day | Projection baseline | India's urban benchmark is 135 LPCD for whole households; hostels share kitchens and laundry, so we assume less | The building's own history |
| A7 | Hourly use follows a morning and evening double peak | Built-in hourly profile | Projection and leak baseline | Common residential pattern | The building's own history |
| A8 | Email is an acceptable alert channel | Email via Amazon SNS | Caretaker alerts | SMS to Indian numbers requires TRAI DLT registration ([AWS docs](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-sms-senderid-india-support.html)), which a hackathon can't complete | Caretaker preference |
| A9 | A caretaker responds within 30 minutes | 30 min real, 2 min in the demo | Escalation timer | — | Caretaker interviews |
| A10 | The tank is an upright prism or cylinder (litres scale with height) | — | Level → litres | — | Tank survey |
| A11 | A top-mounted ultrasonic sensor (ESP32 class) gives readings good to about ±2 mm | ±2 mm simulated noise | Simulator | Typical datasheet range | A hardware test |
| A12 | Hindi is the right second language for residents | English + Hindi | Resident screen | — | Depends on the city; other languages are copy work |

The demo building ("Demo Hostel Block A", 10,000 L roof tank) is fictional.
