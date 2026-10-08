# TankSaathi

**Heat-aware rooftop water-tank and leak early warning for shared buildings.**
Built by **Team NicobarAndaman** for Environmental Hacks (Bharat Builds Tour, Event 02), Heat and Water track.

> TankSaathi tells a hostel caretaker how many hours of water the rooftop tank really has left on a hot day, and raises a leak alert while there is still time to act.

## Status

Work in progress during the hackathon (Oct 8–11, 2026). This README only lists what exists and has been verified; anything planned is marked as planned.

| Capability | Verification level |
|---|---|
| Deterministic core: tank level, outflow rate, heat-adjusted projection, sustained-loss detection, telemetry schema | Unit verified (Vitest) |
| AWS ingestion, incident workflow, app | Not built yet |

## Honesty notes

- **All tank readings in demos come from a labelled sensor simulator.** There is no deployed physical sensor, and no field validation. The telemetry schema is designed for a future ESP32 + ultrasonic sensor.
- **The heat adjustment is an assumption**, not a measured relationship. The 40 °C step follows IMD's plains heatwave threshold; the multipliers are configurable placeholders.
- Deterministic code decides levels, hours remaining, anomalies and incidents. Any AI-written text only explains those results.

## Repository layout

```
packages/core   Deterministic logic shared by backend, simulator and web app
```

## Development

```bash
npm install
npm test
npm run typecheck
```

## AI tools used

Claude Code (Anthropic), with the Superpowers, UI UX Pro Max, Impeccable, Emil Kowalski, Ponytail, Vercel agent-skills and shadcn/ui skills. All code is reviewed and tested by the team.

## Licence

MIT. See [LICENSE](LICENSE).
