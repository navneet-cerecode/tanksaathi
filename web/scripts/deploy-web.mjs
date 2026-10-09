// Builds the web app and deploys web/dist to the stack's Amplify Hosting app (manual deployment).
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const aws = (args) => JSON.parse(execSync(`aws ${args} --region ap-south-1 --output json`, { encoding: "utf8" }));
const outputs = aws("cloudformation describe-stacks --stack-name tanksaathi-dev").Stacks[0].Outputs;
const appId = outputs.find((o) => o.OutputKey === "WebAppId").OutputValue;
const url = outputs.find((o) => o.OutputKey === "WebUrl").OutputValue;

execFileSync(process.execPath, ["scripts/write-env.mjs"], { stdio: "inherit" });
execSync("npx vite build", { stdio: "inherit" });

rmSync("dist.zip", { force: true });
execSync(`powershell -NoProfile -Command "Compress-Archive -Path dist\\* -DestinationPath dist.zip"`, { stdio: "inherit" });

const { jobId, zipUploadUrl } = aws(`amplify create-deployment --app-id ${appId} --branch-name main`);
const res = await fetch(zipUploadUrl, { method: "PUT", body: readFileSync("dist.zip"), headers: { "content-type": "application/zip" } });
if (!res.ok) throw new Error(`upload failed: ${res.status}`);
aws(`amplify start-deployment --app-id ${appId} --branch-name main --job-id ${jobId}`);

for (;;) {
  const { job } = aws(`amplify get-job --app-id ${appId} --branch-name main --job-id ${jobId}`);
  const status = job.summary.status;
  if (status === "SUCCEED") break;
  if (status === "FAILED" || status === "CANCELLED") throw new Error(`deployment ${status}`);
  await new Promise((r) => setTimeout(r, 3_000));
}
rmSync("dist.zip", { force: true });
console.log(`deployed: ${url}`);
