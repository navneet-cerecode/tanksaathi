// Writes web/.env.local from the deployed stack's outputs (public identifiers only).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const out = JSON.parse(
  execFileSync("aws", ["cloudformation", "describe-stacks", "--region", "ap-south-1", "--stack-name", "tanksaathi-dev", "--query", "Stacks[0].Outputs", "--output", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }),
);
const get = (k) => out.find((o) => o.OutputKey === k)?.OutputValue;
writeFileSync(
  ".env.local",
  `VITE_API_URL=${get("ApiUrl")}\nVITE_USER_POOL_ID=${get("UserPoolId")}\nVITE_USER_POOL_CLIENT_ID=${get("UserPoolClientId")}\n`,
);
console.log("wrote web/.env.local");
