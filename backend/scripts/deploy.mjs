// Builds the Lambdas and runs `sam deploy`, taking private parameters
// (alert email, app URL) from the git-ignored .env.deploy file.
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (!existsSync(".env.deploy")) throw new Error("Create backend/.env.deploy from .env.deploy.example first.");
const env = Object.fromEntries(
  readFileSync(".env.deploy", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);
if (!env.ALERT_EMAIL) throw new Error("ALERT_EMAIL missing in .env.deploy");

const overrides = [`Stage=${env.STAGE ?? "dev"}`, `AlertEmail=${env.ALERT_EMAIL}`];
if (env.APP_URL) overrides.push(`AppUrl=${env.APP_URL}`);

execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
// Windows can only launch sam.cmd through a shell, so quote the path (it contains a space).
const sam = process.platform === "win32" ? '"C:/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd"' : "sam";
execSync([sam, "deploy", "--no-progressbar", "--parameter-overrides", ...overrides].join(" "), { stdio: "inherit" });
