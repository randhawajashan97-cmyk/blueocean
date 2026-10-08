import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Chrome, LockKeyhole, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Staff Sign In | Blue Ocean" },
    { name: "description", content: "Secure staff access for Blue Ocean order management." },
    { property: "og:title", content: "Blue Ocean Staff Sign In" },
    { property: "og:description", content: "Secure staff access for Blue Ocean order management." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/staff/orders" });
    });
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true); setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "signup" && !result.data.session) { setMessage("Check your email to confirm your account, then sign in."); return; }
    await navigate({ to: "/staff/orders" });
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) setMessage(result.error.message);
  }

  return <main className="flex min-h-screen items-center justify-center bg-surface-strong px-5 py-12">
    <section className="w-full max-w-md bg-background p-7 shadow-xl sm:p-10">
      <a href="/" className="flex items-center gap-3 text-primary"><span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><UtensilsCrossed className="size-5" /></span><span className="font-display text-xl font-bold">Blue Ocean</span></a>
      <div className="mt-8 flex size-12 items-center justify-center rounded-full bg-accent text-primary"><LockKeyhole className="size-5" /></div>
      <h1 className="mt-4 font-display text-4xl font-bold">Staff access</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with an approved staff account to manage orders.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label><input id="email" name="email" type="email" required maxLength={255} className="form-control" /></div>
        <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label><input id="password" name="password" type="password" required minLength={8} maxLength={72} className="form-control" /></div>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
      </form>
      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-border"/><span className="text-xs text-muted-foreground">OR</span><span className="h-px flex-1 bg-border"/></div>
      <Button variant="outline" className="w-full" onClick={googleSignIn}><Chrome className="size-4" /> Continue with Google</Button>
      <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="mt-6 w-full text-center text-sm font-semibold text-primary hover:underline">{mode === "signin" ? "Create a staff account" : "Already have an account? Sign in"}</button>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">New accounts need a staff role assigned before they can view orders.</p>
    </section>
  </main>;
}