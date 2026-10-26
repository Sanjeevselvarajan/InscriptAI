import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — InscriptAI" },
      { name: "description", content: "Sign in to save and revisit your inscription analyses." },
      { property: "og:title", content: "Sign in — InscriptAI" },
      { property: "og:description", content: "Access your saved inscription history." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (user) nav({ to: "/history" });
  }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border bg-card p-8 shadow-soft">
        <h1 className="font-display text-4xl">{mode === "in" ? "Welcome back" : "Create account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save analyses to your private history.</p>
        {sent ? (
          <p className="mt-6 rounded-lg bg-accent p-4 text-sm text-accent-foreground">
            Check your email to confirm your account, then sign in.
          </p>
        ) : (
          <>
            <div className="mt-6 space-y-2">
              <Button variant="outline" className="w-full" onClick={() => oauth("google")}>
                Continue with Google
              </Button>
              <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                Continue with Lovable
              </button>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
              </Button>
            </form>
          </>
        )}
        <button className="mt-6 text-sm text-primary hover:underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setSent(false); }}>
          {mode === "in" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
