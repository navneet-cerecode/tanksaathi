// Creates fictional demo accounts (example.com, no email is ever sent) with
// random passwords, written to the git-ignored backend/.demo-users.local.json.
// Usage: npx tsx scripts/create-demo-users.ts <userPoolId>
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const poolId = process.argv[2];
if (!poolId) throw new Error("usage: create-demo-users.ts <userPoolId>");
const cognito = new CognitoIdentityProviderClient({ region: "ap-south-1" });
const FILE = ".demo-users.local.json";

const users = [
  { key: "caretaker", email: "caretaker.a@example.com", name: "Demo caretaker (Block A)", buildingId: "demo-hostel-a", groups: ["caretaker"] },
  { key: "resident", email: "resident.a@example.com", name: "Demo resident (Block A)", buildingId: "demo-hostel-a", groups: ["resident"] },
  { key: "operator", email: "operator.a@example.com", name: "Demo operator (Block A)", buildingId: "demo-hostel-a", groups: ["caretaker", "demo-operator"] },
  { key: "caretakerB", email: "caretaker.b@example.com", name: "Demo caretaker (Block B)", buildingId: "demo-hostel-b", groups: ["caretaker"] },
];

const saved: Record<string, { email: string; password: string }> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};

for (const u of users) {
  const password = saved[u.key]?.password ?? `Ts-${randomBytes(12).toString("base64url")}9a`;
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: u.email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: u.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: u.name },
          { Name: "custom:buildingId", Value: u.buildingId },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: u.email, Password: password, Permanent: true }));
  for (const group of u.groups) {
    await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: u.email, GroupName: group }));
  }
  saved[u.key] = { email: u.email, password };
  console.log(`ready: ${u.email} (${u.groups.join(", ")} @ ${u.buildingId})`);
}
writeFileSync(FILE, JSON.stringify(saved, null, 2));
console.log(`credentials saved to backend/${FILE} (git-ignored)`);
