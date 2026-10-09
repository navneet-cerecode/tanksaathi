# TankSaathi design system

Status: **v1, approved by Team NicobarAndaman on 2026-10-08.** This file governs every UI decision. Skills and generators (UI UX Pro Max, shadcn/ui, Emil Kowalski's skills, Vercel guidelines, Impeccable) advise; they don't override it.

## 1. Atmosphere

**Calm civic utility meets a caretaker's physical logbook.**

1. **One answer first.** Every caretaker screen leads with how many hours of water are left, in words and a number.
2. **Show your age.** Every reading-derived number carries its timestamp. Old data looks old.
3. **Calm until it matters.** Normal is quiet. Amber asks for care. Vermilion appears only for an open incident.
4. **Words before colour.** Status is always a sentence; colour and shape reinforce it.
5. **A logbook you can trust.** Ruled lines, local times, who did what and when.
6. **Honest labels.** Simulated data, assumptions and AI-written text are labelled where they appear.

## 2. People and places

| Person | Where | Needs |
|---|---|---|
| Caretaker | Rooftop at 3 PM sun, one hand, mid-range Android, patchy 4G; corridor; desk | Hours left, is it normal, what to do next, acknowledge fast |
| Resident | Hostel room or corridor, phone | Is there water, should I save it, when will it be back |
| Demo operator | Laptop while recording | Drive scenarios with an obvious "this is simulated" disclosure |

## 3. Information hierarchy

| Screen | 1st | 2nd | 3rd | Dominant action |
|---|---|---|---|---|
| Caretaker overview | Status sentence + hours left | Tank gauge, usable litres, freshness | Heat note, active incident strip | "Review alert" when an incident is open, otherwise none |
| Tank detail | Level over 24 h | Hourly use vs expected, flagged hours | How the rule works; assumptions | Back / open incident |
| Incident | What happened, in one sentence | Severity, water left, time detected | Timeline / audit | The single next lifecycle step |
| Resident status | Status word in large type | One sentence of guidance, EN + HI | Last updated, refill time | Language toggle |
| Demo simulator | Disclosure ribbon | Six scenario controls with descriptions | Last run log | Run scenario |

## 4. Typography

- **IBM Plex Sans** for UI (research match: "Financial Trust" pairing, high legibility, excellent tabular figures).
- **IBM Plex Sans Devanagari** for Hindi (same family, so EN and HI read as one voice).
- **IBM Plex Mono** only for timeline timestamps and raw IDs.
- All figures use `font-variant-numeric: tabular-nums`.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `type-figure` | 56 / 60 (mobile), 64 / 68 (desktop) | 600 | Hours left |
| `type-title` | 22 / 28 | 600 | Screen title, resident status word (28/34 on resident screen) |
| `type-heading` | 18 / 24 | 600 | Section headings |
| `type-body` | 16 / 24 | 400 | Body (never below 16 on mobile) |
| `type-label` | 14 / 20 | 500 | Field labels, chart axes titles |
| `type-caption` | 13 / 18 | 400 | Timestamps, footnotes (floor: 13) |
| `type-mono` | 13 / 18 | 400 | Timeline times, IDs |

Sentence case everywhere. No all-caps paragraphs; short uppercase tags (e.g. `SIMULATED`) are allowed with +0.04em tracking.

## 5. Colour

Light only. TankSaathi is outdoor-first, and dark UIs wash out in direct sun. Contrast is measured against `paper` (#F6F2E7).

| Token | Hex | Contrast | Role |
|---|---|---|---|
| `paper` | `#F6F2E7` | — | App background (field paper) |
| `surface` | `#FFFDF7` | — | Sheets, dialogs, inputs |
| `ink` | `#17202E` | 14.6 : 1 | Primary text, chart lines |
| `ink-2` | `#465063` | 7.3 : 1 | Secondary text, gauge ticks, axes |
| `rule` | `#D8CFBA` | decorative | Logbook dividers only (never meaning) |
| `water` | `#0B6B66` | 5.7 : 1 | Normal status, links, expected-use line |
| `water-tint` | `#DCEDEA` | — | Gauge fill, normal band |
| `amber-ink` | `#8A5300` | 5.7 : 1 | Conserve/stale text and icons |
| `amber-fill` | `#F3C969` | ink on it 10.4 : 1 | Conserve/stale banners (ink text only, never white) |
| `vermilion` | `#B42318` | 5.9 : 1 | Open incident only; white text on it 6.6 : 1 |
| `vermilion-tint` | `#F8E1DD` | — | Incident strip background |
| `focus` | `#1D4ED8` | 6.0 : 1 | 2 px focus ring, offset 2 px |
| `sim` | `#E9E1CC` + diagonal hatch | ink on it | Simulator disclosure ribbon |
| `chart-observed` | `#008C80` | 3 : 1+ | Chart marks only: observed use |
| `chart-expected` | `#7650B8` | 3 : 1+ | Chart marks only: expected use (validated pair: CVD ΔE 14.1, normal-vision ΔE 22.5) |

Rules: components use tokens, never raw hex. Informative graphics (gauge ticks, chart marks) need at least 3:1, so they use `ink`, `ink-2`, `water` or `vermilion`, never `rule`.

## 6. Spacing and layout

- 4-point scale: 4, 8, 12, 16, 24, 32, 48.
- Page gutter: 16 px mobile, 24 tablet, 32 desktop. No horizontal scroll at 360 px.
- **Mobile (360–767):** single column; bottom tab bar (Overview, Tank, Alerts) for caretakers, ≤ 3 tabs; resident is a single screen.
- **Desktop (≥ 1024):** two columns, left 5/12 status + gauge, right 7/12 chart + incident; max content width 1200.

## 7. Surfaces

- Dividers over containers: sections separated by a 1 px `rule` line, like a ruled ledger.
- At most one level of container. **No cards inside cards.**
- Radius: 4 px for inputs and buttons; 8 px for the top corners of sheets and dialogs.
- One shadow token, used only by dialogs and sheets: `0 8px 24px rgb(23 32 46 / 0.14)`.

## 8. Density

Comfortable on touch: list rows ≥ 48 px, primary buttons 48 px high, minimum target 44 × 44. Desktop tables may be compact (40 px rows).

## 9. Data visualisation

- **Tank gauge:** an upright tank outline with ruled ticks every 10%, labels at 25/50/75, `water-tint` fill, and the level as text beside it ("62%"). It never stands alone without the number.
- **Level over 24 h:** an `ink` line with a light `water-tint` area; x-axis in local time (IST); y-axis 0–100%.
- **Hourly use vs expected:** observed bars in `chart-observed`, expected as a dashed `chart-expected` line (one shared L/h axis, legend + direct label). Flagged hours get a `vermilion` marker **and** a text label ("above expected").
- Every chart has a one-paragraph text summary above it and a "Show as table" toggle (research: anomaly charts need a list/table fallback; never colour alone).
- No chart animation loops; the line draws once (§13).

## 10. Forms

Labels above fields; helper text below; errors inline in words, linked with `aria-describedby`. Resolution reasons are large radio rows, not a dropdown. The note field has a visible 500-character counter. Buttons use verbs: "Acknowledge alert", "Start inspection", "Mark as resolved".

## 11. States

| State | Treatment |
|---|---|
| Loading | Skeleton blocks in the final layout (no full-page spinner) |
| Empty | "No readings yet. The sensor hasn't reported for this tank." |
| Error | What failed + a retry button; never a raw error code alone |
| Stale (> 20 min) | Amber banner: "Last reading 45 min ago, so this estimate may be wrong. Check the sensor." Numbers dim to `ink-2`. |
| Offline | "You're offline. Showing what we last saw at 15:02." Actions disabled with a reason. |
| Simulated | Hatched `sim` ribbon: "Sensor simulator — not a real tank" on every reading-derived screen |
| Assumption | Inline note with "Assumption" tag (e.g. heat multiplier) linking to ASSUMPTIONS.md |
| AI-written | Explanation panel tagged "AI-written summary · check against the readings"; deterministic text shows "Standard message" |

(No verified UI UX Pro Max match existed for stale-data handling; these rules come from the TankSaathi brief.)

## 12. Motion

| Moment | Motion | Timing | Reduced motion |
|---|---|---|---|
| New reading | Gauge fill eases to the new level; the number swaps (no counting) | 400 ms, `cubic-bezier(0.2, 0, 0, 1)` | Instant |
| Status change | Band colour crossfade and sentence swap | 200 ms | Instant |
| Incident appears | Strip slides 8 px and fades in | 220 ms in / 150 ms out | Fade only |
| Timeline step | New row fades in, 4 px rise | 180 ms | Instant |
| Simulator run | Level line draws once | 600 ms | Static |
| First load | Content fades in, ≤ 3 groups | ≤ 300 ms total | None |

Implemented with CSS transitions (GSAP was evaluated and removed: frame-driven tweens left the gauge empty in background tabs). Transform and opacity only. Exits are faster than entrances. Nothing loops. Numbers never animate continuously. Every workflow works with motion off.

## 13. Accessibility (WCAG 2.2 AA)

- Keyboard-complete workflows; visible focus everywhere; logical headings per screen.
- `role="status"` with one atomic, meaningful message for reading updates ("Tank at 62%, about 9 hours left"); `role="alert"` only when a new incident opens (research: never announce a bare number).
- Status never by colour alone; icons always paired with text.
- Charts: summary + table. Hindi strings carry `lang="hi"`.
- 200% zoom without loss. Verified at 360×800, 390×844, 768×1024, 1280×720, 1440×900.

## 14. Components

shadcn/ui primitives, restyled with these tokens (never the default look): Button, Dialog, Sheet, RadioGroup, Label, Textarea, Badge, Alert, Separator, Skeleton, Table, Tooltip (non-critical only), Sonner toasts.

Custom: `TankGauge`, `HoursLeft`, `FreshnessStamp`, `StatusSentence`, `IncidentStrip`, `IncidentTimeline`, `LifecycleStepper`, `LevelChart`, `HourlyUseChart`, `ChartSummary`, `SimulatorRibbon`, `ScenarioButton`, `LanguageToggle`, `AppFooter` ("Team NicobarAndaman").

Icons: Lucide only.

## 15. Copy and tone

Plain, specific, never alarmist. "About 3 hours of water left at today's use" rather than "CRITICAL LEVEL". Times are local ("01:50 IST"). Hours are rounded ("about 4 hours"; "less than 1 hour").

| Status | English | हिन्दी (needs native review, A12) |
|---|---|---|
| Normal | Water supply is normal. | पानी की आपूर्ति सामान्य है। |
| Conserve | Please use water carefully. | कृपया पानी सोच-समझकर इस्तेमाल करें। |
| Refill planned | The tank will be refilled at 17:30. | टंकी 17:30 बजे भरी जाएगी। |
| Incident | A possible leak is being checked. Please save water. | संभावित रिसाव की जाँच हो रही है। कृपया पानी बचाएँ। |
| Stale | This status may be out of date. | यह जानकारी पुरानी हो सकती है। |

## 16. Forbidden

Purple-blue gradients, glassmorphism, neon, decorative blobs, cards in cards, heavy shadows, giant marketing headlines inside the app, low-contrast grey text, icon-only critical controls, motion on every component, fake statistics, fake testimonials, stock imagery presented as ours, default shadcn styling as the identity, dark-mode-first dashboards.

## 17. Research and reference log

| Source | Taken | Rejected | Why |
|---|---|---|---|
| UI UX Pro Max v2.13.0 `--design-system` (variance 3, motion 2, density 7) | Swiss-minimal structure; status semantics; "label telemetry live only with update time and stale state"; static final state under reduced motion | Dark navy theme, Fira Code headings, green CTA, landing-page section order | Brief requires sunlight-readable warm paper and an operational tool, not a marketing page |
| UI UX Pro Max typography search | IBM Plex Sans; IBM Plex Sans Devanagari | Mono headings | Plex covers both scripts; mono headings read as a developer tool |
| UI UX Pro Max chart search ("anomaly detection") | Line with highlighted anomalies; shape + text, not colour; event table + narrative fallback | Suggested libraries (D3/Plotly/ApexCharts) | Recharts is enough for two charts |
| UI UX Pro Max UX search ("live region") | One atomic `role="status"` message | — | — |
| Godly, Transitions.dev, Deck.gallery, getdesign.md | *Pending: 60-minute timeboxed review, Oct 9* | — | Principles only; no assets, wording or layouts copied |

Inspiration is translated, never copied: no third-party logos, illustrations, wording or full layouts enter the product.
