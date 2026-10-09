// Drive the demo through the real API as the demo operator (same path as the Simulator screen).
// Usage: npx tsx scripts/demo.ts reset | normal | heat | leak | stale | recovery | resolve
import { readFileSync } from "node:fs";
import { AdminInitiateAuthCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";

const region = "ap-south-1";
const cmd = process.argv[2] ?? "normal";
const outputs = Object.fromEntries(
  ((await new CloudFormationClient({ region }).send(new DescribeStacksCommand({ StackName: "tanksaathi-dev" }))).Stacks?.[0]?.Outputs ?? []).map((o) => [o.OutputKey!, o.OutputValue!]),
);
const op = JSON.parse(readFileSync(".demo-users.local.json", "utf8")).operator as { email: string; password: string };
const auth = await new CognitoIdentityProviderClient({ region }).send(
  new AdminInitiateAuthCommand({
    UserPoolId: outputs.UserPoolId,
    ClientId: outputs.UserPoolClientId,
    AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: op.email, PASSWORD: op.password },
  }),
);
const token = auth.AuthenticationResult!.IdToken!;
const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`${outputs.ApiUrl}/buildings/demo-hostel-a${path}`, {
    method,
    headers: { authorization: token, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (cmd === "reset") console.log(await call("POST", "/demo/reset"));
else if (cmd === "resolve") {
  const open = (await call("GET", "/incidents")).body.incidents.find((i: { status: string }) => i.status !== "resolved");
  if (!open) throw new Error("no open incident");
  for (const step of [{ action: "acknowledge" }, { action: "resolve", resolution: "leak-fixed", note: "Resolved from scripts/demo.ts" }]) {
    for (let i = 0; i < 8; i++) {
      const r = await call("POST", `/incidents/${open.incidentId}/actions`, step);
      if (r.status !== 409 || r.body.error !== "workflow-not-ready") {
        console.log(step.action, r.status, r.body);
        break;
      }
      await sleep(1_500);
    }
  }
} else console.log(await call("POST", "/demo/scenarios", { scenario: cmd }));
