import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn as amplifySignIn, signOut as amplifySignOut } from "aws-amplify/auth";
import { config } from "./config";

Amplify.configure({
  Auth: { Cognito: { userPoolId: config.userPoolId, userPoolClientId: config.userPoolClientId, loginWith: { email: true } } },
});

export type Role = "caretaker" | "resident" | "demo-operator";

export interface Session {
  idToken: string;
  name: string;
  buildingId: string;
  roles: Role[];
}

export async function currentSession(): Promise<Session | null> {
  try {
    const { tokens } = await fetchAuthSession();
    const idToken = tokens?.idToken;
    if (!idToken) return null;
    const p = idToken.payload;
    const groups = (p["cognito:groups"] as string[] | undefined) ?? [];
    return {
      idToken: idToken.toString(),
      name: (p.name as string | undefined) ?? (p.email as string),
      buildingId: p["custom:buildingId"] as string,
      roles: groups.filter((g): g is Role => g === "caretaker" || g === "resident" || g === "demo-operator"),
    };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const result = await amplifySignIn({ username: email.trim(), password });
  if (!result.isSignedIn) throw new Error("This account needs an extra sign-in step that TankSaathi doesn't support yet.");
}

export const signOut = () => amplifySignOut();
