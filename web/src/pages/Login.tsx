import { Droplet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (err) {
      const name = (err as Error).name;
      setError(name === "NotAuthorizedException" || name === "UserNotFoundException" ? "That email and password don't match." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <Droplet className="size-6 text-water" aria-hidden />
        <span className="text-title font-semibold">TankSaathi</span>
      </div>
      <h1 className="text-title font-semibold">Sign in</h1>
      <p className="mt-1 text-ink-2">For caretakers and residents of your building.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-label">Email</Label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-sm border border-ink-2 bg-surface px-3 text-base"
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-label">Password</Label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-sm border border-ink-2 bg-surface px-3 text-base"
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-label text-vermilion">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-10 text-caption text-ink-2">Team NicobarAndaman · Environmental Hacks 2026</p>
    </div>
  );
}
