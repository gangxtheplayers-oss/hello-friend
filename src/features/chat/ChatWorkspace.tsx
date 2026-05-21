import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Send, Square, Trash2, Sparkles, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/features/chat/VoiceInput";
import { VoiceOutput } from "@/features/chat/VoiceOutput";

type Conv = { id: string; title: string; updated_at: string; messages: UIMessage[] };

const STORAGE_KEY = "astra:session-chats";

function isRtl(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function loadConvs(): Conv[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conv[]) : [];
  } catch {
    return [];
  }
}

function saveConvs(convs: Conv[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    /* ignore quota errors */
  }
}

function newId() {
  return (crypto && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
}

export function ChatWorkspace({ threadId }: { threadId?: string } = {}) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [convs, setConvs] = useState<Conv[]>(() => loadConvs());

  // Keep sessionStorage in sync
  useEffect(() => { saveConvs(convs); }, [convs]);

  const currentConv = useMemo(
    () => (threadId ? convs.find((c) => c.id === threadId) : undefined),
    [convs, threadId],
  );

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: threadId ?? "new",
    messages: currentConv?.messages ?? [],
    transport,
    onError: (e) => toast.error(e.message),
    onFinish: ({ message }) => {
      if (!threadId) return;
      const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
      if (!text) return;
      setConvs((prev) =>
        prev.map((c) =>
          c.id === threadId
            ? {
                ...c,
                updated_at: new Date().toISOString(),
                messages: [...c.messages, { id: message.id, role: "assistant", parts: [{ type: "text", text }] } as UIMessage],
              }
            : c,
        ),
      );
    },
  });

  // Hydrate messages when switching threads
  useEffect(() => {
    setMessages(currentConv?.messages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const onSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !user || isLoading) return;
    let convId = threadId;
    if (!convId) {
      convId = newId();
      const newConv: Conv = {
        id: convId,
        title: text.slice(0, 60),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      setConvs((prev) => [newConv, ...prev]);
      router.navigate({ to: "/chat/$threadId", params: { threadId: convId } });
    }
    const userMsg: UIMessage = { id: newId(), role: "user", parts: [{ type: "text", text }] } as UIMessage;
    setConvs((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, updated_at: new Date().toISOString(), messages: [...c.messages, userMsg] }
          : c,
      ),
    );
    setInput("");
    await sendMessage({ text });
  }, [input, user, isLoading, threadId, router, sendMessage]);

  const onDelete = (id: string) => {
    setConvs((prev) => prev.filter((c) => c.id !== id));
    if (threadId === id) navigate({ to: "/chat" });
  };

  const sortedConvs = [...convs].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const filteredConvs = sortedConvs.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen">
      {/* Conversations sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-e bg-sidebar/50 p-3 lg:flex">
        <Button onClick={() => navigate({ to: "/chat" })} className="mb-3 w-full justify-start glow-electric">
          <Plus className="me-2 h-4 w-4" /> {t("newChat")}
        </Button>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="ps-9" />
        </div>
        <div className="mb-2 rounded-md border border-dashed border-muted-foreground/30 p-2 text-[11px] leading-snug text-muted-foreground">
          {lang === "ar"
            ? "المحادثات مؤقتة — تُمسح عند إغلاق المتصفح."
            : "Chats are temporary — cleared when you close the browser."}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {filteredConvs.map((c) => (
              <div key={c.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-sm transition ${threadId === c.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}>
                <button
                  onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: c.id } })}
                  className="min-w-0 flex-1 truncate text-start"
                >
                  {c.title || "Untitled"}
                </button>
                <button onClick={() => onDelete(c.id)} className="ms-2 opacity-0 transition group-hover:opacity-100" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {filteredConvs.length === 0 && <div className="px-2 py-4 text-xs text-muted-foreground">{lang === "ar" ? "لا توجد محادثات بعد" : "No conversations yet"}</div>}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat panel */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                <Sparkles className="mb-4 h-10 w-10 text-electric animate-pulse-glow" />
                <h2 className="text-2xl font-semibold">{t("emptyChat")}</h2>
                <p className="mt-2 text-muted-foreground">{t("emptyChatHint")}</p>
                <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    lang === "ar" ? "اشرحلي الذكاء الاصطناعي ببساطة" : "Explain quantum computing simply",
                    lang === "ar" ? "اكتب إيميل احترافي لعميل" : "Write a professional client email",
                    lang === "ar" ? "ترجم: hello, how are you?" : "Translate: مرحبا كيف حالك؟",
                    lang === "ar" ? "لخص اجتماع اليوم" : "Summarize today's meeting",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="rounded-xl glass p-3 text-start text-sm transition hover:border-electric/40">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, idx) => {
                  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                  const rtl = isRtl(text);
                  let preferLang: "ar" | "en" | undefined;
                  if (m.role === "assistant") {
                    for (let i = idx - 1; i >= 0; i -= 1) {
                      if (messages[i].role === "user") {
                        const utext = messages[i].parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                        preferLang = isRtl(utext) ? "ar" : "en";
                        break;
                      }
                    }
                  }
                  return (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "glass"
                      }`} dir={rtl ? "rtl" : "ltr"}>
                        <div className="prose prose-invert max-w-none prose-p:my-2 prose-pre:bg-black/40 prose-code:text-electric">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                        </div>
                        {m.role === "assistant" && text && <VoiceOutput text={text} appLang={lang} preferLang={preferLang} />}
                        {m.role === "assistant" && text && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(text); toast.success(lang === "ar" ? "تم النسخ" : "Copied"); }}
                            className="absolute -bottom-3 end-2 rounded-md bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                            aria-label="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-electric" />
                    {lang === "ar" ? "أسترا تفكر…" : "Astra is thinking…"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t bg-background/60 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl p-4">
            <div className="rounded-2xl glass-strong p-2">
              <VoiceInput appLang={lang} disabled={isLoading} onUseTranscript={setInput} onSendTranscript={(text) => onSend(text)} />
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
                    if (e.key === "Escape" && isLoading) stop();
                  }}
                  dir={isRtl(input) ? "rtl" : "ltr"}
                  placeholder={t("askAnything")}
                  rows={1}
                  className="min-h-[44px] resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                />
                {isLoading ? (
                  <Button onClick={stop} size="icon" variant="secondary" aria-label="Stop"><Square className="h-4 w-4" /></Button>
                ) : (
                  <Button onClick={() => onSend()} disabled={!input.trim()} size="icon" className="glow-electric" aria-label="Send"><Send className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {lang === "ar" ? "اضغط Enter للإرسال، Shift+Enter لسطر جديد، Esc للإيقاف" : "Enter to send · Shift+Enter for newline · Esc to stop"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
