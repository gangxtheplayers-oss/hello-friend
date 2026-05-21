import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Task = {
  id: string; title: string; description: string | null;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null; created_at: string;
};

export function TasksPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");

  const tasksQ = useQuery({
    queryKey: ["tasks", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) return;
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id, title: title.trim(), description: desc.trim() || null, priority,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setDesc(""); setPriority("medium"); qc.invalidateQueries({ queryKey: ["tasks", user?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = async (task: Task) => {
    const status = task.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["tasks", user?.id] });
  };

  const del = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks", user?.id] });
  };

  const priorityColor = (p: Task["priority"]) =>
    p === "urgent" ? "bg-destructive/20 text-destructive" : p === "high" ? "bg-electric/20 text-electric" : p === "medium" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t("tasks")}</h1>

      <div className="mb-8 rounded-2xl glass-strong p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["low","medium","high","urgent"] as const).map(p => <SelectItem key={p} value={p}>{t(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => addM.mutate()} disabled={!title.trim() || addM.isPending} className="glow-electric"><Plus className="me-1 h-4 w-4" />{t("addTask")}</Button>
        </div>
        <Textarea placeholder={t("description")} value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-3" rows={2} />
      </div>

      <div className="space-y-2">
        {tasksQ.data?.length === 0 && (
          <div className="rounded-2xl glass p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد مهام بعد. أضف أول مهمة بالأعلى." : "No tasks yet. Add your first one above."}
          </div>
        )}
        {tasksQ.data?.map((task) => (
          <div key={task.id} className="group flex items-start gap-3 rounded-xl glass p-4 transition hover:border-electric/30">
            <button onClick={() => toggle(task)} className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${task.status === "done" ? "bg-electric border-electric" : "border-border"}`}>
              {task.status === "done" && <Check className="h-3.5 w-3.5 text-background" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</div>
              {task.description && <div className="mt-1 text-sm text-muted-foreground">{task.description}</div>}
              <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs ${priorityColor(task.priority)}`}>{t(task.priority)}</span>
            </div>
            <button onClick={() => del(task.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
