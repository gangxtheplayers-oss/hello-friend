import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download } from "lucide-react";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();

  const exportData = async () => {
    if (!user) return;
    const [conv, msg, tasks, mem] = await Promise.all([
      supabase.from("conversations").select("*"),
      supabase.from("messages").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("memories").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({
      conversations: conv.data, messages: msg.data, tasks: tasks.data, memories: mem.data,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `astra-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(lang === "ar" ? "تم التصدير" : "Exported");
  };

  const deleteAll = async () => {
    if (!user) return;
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف كل البيانات؟" : "Delete all your data? This cannot be undone.")) return;
    await Promise.all([
      supabase.from("conversations").delete().eq("user_id", user.id),
      supabase.from("tasks").delete().eq("user_id", user.id),
      supabase.from("memories").delete().eq("user_id", user.id),
    ]);
    toast.success(lang === "ar" ? "تم حذف كل البيانات" : "All data deleted");
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t("settings")}</h1>

      <div className="space-y-6">
        <div className="rounded-2xl glass-strong p-5">
          <h2 className="mb-4 text-lg font-semibold">{lang === "ar" ? "عام" : "General"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("language")}</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ar")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass-strong p-5">
          <h2 className="mb-4 text-lg font-semibold">{lang === "ar" ? "الحساب والخصوصية" : "Account & Privacy"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData} variant="outline"><Download className="me-2 h-4 w-4" />{t("exportData")}</Button>
            <Button onClick={deleteAll} variant="destructive">{t("deleteAllData")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
