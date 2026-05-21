import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Memory = { id: string; category: string; content: string; enabled: boolean; created_at: string };

export function MemoriesPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [category, setCategory] = useState("note");
  const [content, setContent] = useState("");

  const memQ = useQuery({
    queryKey: ["memories", user?.id], enabled: !!user,
    queryFn: async (): Promise<Memory[]> => {
      const { data, error } = await supabase.from("memories").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Memory[];
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) return;
      const { error } = await supabase.from("memories").insert({ user_id: user.id, category, content: content.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setContent(""); qc.invalidateQueries({ queryKey: ["memories", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = async (id: string) => {
    await supabase.from("memories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["memories", user?.id] });
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Brain className="h-7 w-7 text-electric" />
        <h1 className="text-3xl font-semibold tracking-tight">{t("memories")}</h1>
      </div>

      <div className="mb-8 rounded-2xl glass-strong p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lang === "ar" ? "التصنيف" : "Category"} />
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder={lang === "ar" ? "اكتب الذاكرة…" : "Write a memory…"} />
          <Button onClick={() => addM.mutate()} disabled={!content.trim()} className="glow-electric"><Plus className="me-1 h-4 w-4" />{t("addMemory")}</Button>
        </div>
      </div>

      <div className="space-y-2">
        {memQ.data?.length === 0 && (
          <div className="rounded-2xl glass p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد ذكريات بعد." : "No memories yet."}
          </div>
        )}
        {memQ.data?.map((m) => (
          <div key={m.id} className="group flex items-start gap-3 rounded-xl glass p-4">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">{m.category}</span>
            <div className="flex-1 text-sm">{m.content}</div>
            <button onClick={() => del(m.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
