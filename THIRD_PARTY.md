# Third-party software and data

Everything below was written by others and is used under its licence. Versions are those in `package-lock.json` at the time of writing.

| Package | Version | Licence | Used for |
|---|---|---|---|
| React, React DOM | 19.x | MIT | Web UI |
| React Router | 8.4 | MIT | Web routing |
| Vite, @vitejs/plugin-react | 8.x | MIT | Web build |
| Tailwind CSS, @tailwindcss/vite | 4.3 | MIT | Styling |
| shadcn/ui components (copied into `web/src/components/ui`, restyled) and its Tailwind stylesheet (`web/src/styles/shadcn-tailwind.css`) | 4.21 | MIT | Dialog, radio group, label, textarea, skeleton, toast, button |
| Radix UI | 1.7 | MIT | Accessible primitives under shadcn/ui |
| class-variance-authority | 0.7 | Apache-2.0 | Button variants |
| cn | 0.4 | MIT | Class name merging |
| tw-animate-css | 1.4 | MIT | Enter animations |
| Sonner | 2.0 | MIT | Toasts |
| Recharts | 3.10 | MIT | Charts |
| Lucide React | 1.53 | ISC | Icons |
| AWS Amplify JS (auth only) | 6.22 | Apache-2.0 | Cognito sign-in |
| IBM Plex Sans, Sans Devanagari, Mono (@fontsource) | 5.x | SIL Open Font License 1.1 | Typography |
| AWS SDK for JavaScript v3 | 3.x | Apache-2.0 | AWS calls |
| Powertools for AWS Lambda (TypeScript) | 2.36 | MIT-0 | Logging and metrics |
| Cedar (@cedar-policy/cedar-wasm) | 4.13 | Apache-2.0 | Authorization |
| Zod | 4.6 | MIT | Validation |
| MQTT.js | 5.16 | MIT | Simulator device runner |
| esbuild, tsx, TypeScript, Vitest | — | MIT / Apache-2.0 | Build and test |

**Data and references.** No third-party datasets are bundled. Problem statistics are cited with links in ASSUMPTIONS.md. Design references are inspiration only (see DESIGN.md §17); no third-party assets, wording or layouts are used.
