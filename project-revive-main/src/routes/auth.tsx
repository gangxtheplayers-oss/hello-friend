import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AstraLogo } from "@/components/AstraLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Astra Intelligence" }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.navigate({ to: "/chat" });
  }, [user, loading, router]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirect = typeof window !== "undefined" ? window.location.origin + "/chat" : undefined;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirect, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success(lang === "ar" ? "تم إنشاء حسابك. تحقق من بريدك." : "Account created. Check your email to verify.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/chat" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/chat" });
      if (res.error) throw new Error(res.error instanceof Error ? res.error.message : String(res.error));
      if (!res.redirected) router.navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid-bg absolute inset-0" />
      <div className="absolute left-1/2 top-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      <div className="relative w-full max-w-md rounded-2xl glass-strong p-8">
        <div className="mb-6 flex items-center gap-3">
          <AstraLogo />
          <div>
            <div className="text-sm text-muted-foreground">{t("appName")}</div>
            <h1 className="text-xl font-semibold">{mode === "signin" ? t("signIn") : t("signUp")}</h1>
          </div>
        </div>

        <Button onClick={google} disabled={busy} variant="outline" className="w-full">
          <svg className="me-2 h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.4 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-3.5 5.4-5.9 9.6-5.9 2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.4 29.2 4.5 24 4.5c-7.4 0-13.7 4.2-17 10.2z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.1-11.2-7.5l-6.5 5c3.3 6.4 9.9 10.6 17.7 10.6z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.2-.1-2.4-.4-3.5z"/></svg>
          {t("continueWithGoogle")}
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> {t("or")} <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handle} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" disabled={busy} className="w-full glow-electric">
            {mode === "signin" ? t("signIn") : t("signUp")}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>{lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}<button className="text-electric hover:underline" onClick={() => setMode("signup")}>{t("signUp")}</button></>
          ) : (
            <>{lang === "ar" ? "لديك حساب؟" : "Already have an account?"}{" "}<button className="text-electric hover:underline" onClick={() => setMode("signin")}>{t("signIn")}</button></>
          )}
        </div>
      </div>
    </div>
  );
}
