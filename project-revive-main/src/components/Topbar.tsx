import { Link, useRouter } from "@tanstack/react-router";
import { AstraLogo } from "./AstraLogo";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Globe, LogOut } from "lucide-react";

export function Topbar() {
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useI18n();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <AstraLogo />
          <span className="font-display text-lg font-semibold tracking-tight">{t("appName")}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" hash="features" className="hover:text-foreground transition">{t("features")}</Link>
          <Link to="/" hash="faq" className="hover:text-foreground transition">{t("faq")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="Language">
            <Globe className="h-4 w-4" />
          </Button>
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/chat">{t("dashboard")}</Link></Button>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); router.navigate({ to: "/" }); }} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">{t("signIn")}</Link></Button>
              <Button asChild size="sm" className="glow-electric"><Link to="/auth">{t("getStarted")}</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
