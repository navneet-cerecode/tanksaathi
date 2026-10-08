// End-to-end check against the deployed stack with real Cognito tokens:
// access boundaries, then a full incident lifecycle through Step Functions.
// Usage: npx tsx scripts/api-smoke.ts
import { readFileSync } from "node:fs";
import { AdminInitiateAuthCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { DescribeExecutionCommand, SFNClient } from "@aws-sdk/client-sfn";

const region = "ap-south-1";
const outputs = Object.fromEntries(
  ((await new CloudFormationClient({ region }).send(new DescribeStacksCommand({ StackName: "tanksaathi-dev" }))).Stacks?.[0]?.Outputs ?? []).map(
    (o) => [o.OutputKey!, o.OutputValue!],
  ),
);
const api = outputs.ApiUrl!;
const users = JSON.parse(readFileSync(".demo-users.local.json", "utf8")) as Record<string, { email: string; password: string }>;
const cognito = new CognitoIdentityProviderClient({ region });
const sfn = new SFNClient({ region });

async function token(key: string) {
  const res = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: outputs.UserPoolId,
      ClientId: outputs.UserPoolClientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: users[key]!.email, PASSWORD: users[key]!.password },
    }),
  );
  return res.AuthenticationResult!.IdToken!;
}

async function call(idToken: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { ...(idToken ? { authorization: idToken } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  let v = await fn();
  while (!done(v) && Date.now() < end) {
    await sleep(1_500);
    v = await fn();
  }
  return v;
}

const A = "/buildings/demo-hostel-a";
const [resident, caretaker, operator, caretakerB] = await Promise.all(["resident", "caretaker", "operator", "caretakerB"].map(token));

console.log("— access boundaries");
check("no token → 401", (await call(null, "GET", "/me")).status, 401);
check("resident sees own status", (await call(resident, "GET", `${A}/status`)).status, 200);
check("resident can't see Block B", (await call(resident, "GET", "/buildings/demo-hostel-b/status")).status, 403);
check("resident can't open tank detail", (await call(resident, "GET", `${A}/tanks/roof-1`)).status, 403);
check("resident can't act on incidents", (await call(resident, "POST", `${A}/incidents/roof-1-x/actions`, { action: "acknowledge" })).status, 403);
check("resident can't run the simulator", (await call(resident, "POST", `${A}/demo/scenarios`, { scenario: "leak" })).status, 403);
check("caretaker can't run the simulator", (await call(caretaker, "POST", `${A}/demo/scenarios`, { scenario: "leak" })).status, 403);
check("Block B caretaker can't see Block A tank", (await call(caretakerB, "GET", `${A}/tanks/roof-1`)).status, 403);
check("bad ids are rejected", (await call(caretaker, "GET", "/buildings/DROP TABLE/status")).status, 400);

console.log("— incident lifecycle");
check("operator resets the demo", (await call(operator, "POST", `${A}/demo/reset`)).status, 200);
await sleep(21_000); // the simulator allows one run per 20 s
check("operator runs the leak scenario", (await call(operator, "POST", `${A}/demo/scenarios`, { scenario: "leak" })).status, 202);
check("an immediate second run is rate-limited", (await call(operator, "POST", `${A}/demo/scenarios`, { scenario: "leak" })).status, 429);

const list = await until(
  () => call(caretaker, "GET", `${A}/incidents`),
  (r) => r.body?.incidents?.some((i: { status: string; awaiting?: string }) => i.status === "open" && i.awaiting === "acknowledgement"),
);
const incident = list.body.incidents[0];
check("one simulated incident is open and waiting", `${list.body.incidents.length} ${incident?.status} ${incident?.simulated}`, "1 open true");
const tank = await call(caretaker, "GET", `${A}/tanks/roof-1`);
check("tank detail shows the detection", tank.status === 200 && tank.body.state.anomaly.firstDetectedAt !== null, true);
check("resident sees 'incident'", (await call(resident, "GET", `${A}/status`)).body.status, "incident");

const path = `${A}/incidents/${incident.incidentId}/actions`;
check("resolve before acknowledge is refused", (await call(caretaker, "POST", path, { action: "resolve", resolution: "leak-fixed" })).status, 409);
const ack = await call(caretaker, "POST", path, { action: "acknowledge" });
check("acknowledge resumes the workflow", `${ack.status} ${ack.body.workflow}`, "200 resumed");
check("acknowledging twice is refused", (await call(caretaker, "POST", path, { action: "acknowledge" })).status, 409);
check("inspect", (await call(caretaker, "POST", path, { action: "inspect", note: "Float valve stuck open on roof tank" })).status, 200);
await until(
  () => call(caretaker, "GET", `${A}/incidents/${incident.incidentId}`),
  (r) => r.body?.awaiting === "resolution",
);
const resolve = await call(caretaker, "POST", path, { action: "resolve", resolution: "leak-fixed", note: "Replaced float valve washer" });
check("resolve resumes the workflow", `${resolve.status} ${resolve.body.workflow}`, "200 resumed");

const detail = (await call(caretaker, "GET", `${A}/incidents/${incident.incidentId}`)).body;
check("timeline has opened → acknowledge → inspect → resolve", detail.timeline.map((e: { action: string }) => e.action).join(" → "), "opened → acknowledge → inspect → resolve");
check("task tokens never leave the API", "taskToken" in detail, false);
const execution = await until(
  () => sfn.send(new DescribeExecutionCommand({ executionArn: detail.workflowExecution })),
  (e) => e.status !== "RUNNING",
);
check("Step Functions execution finished", execution.status, "SUCCEEDED");
check("resident no longer sees 'incident'", (await call(resident, "GET", `${A}/status`)).body.status !== "incident", true);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
