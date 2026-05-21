import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Send, Square, Trash2, Sparkles, Copy, Search, Home } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/features/chat/VoiceInput";
import { VoiceOutput } from "@/features/chat/VoiceOutput";

type Conv = { id: string; title: string; updated_at: string; messages: UIMessage[] };

const STORAGE_KEY = "astra:session-chats";
const FORCED_LANG_KEY = "astra:forced-lang";

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

function detectForcedLang(text: string): "ar" | "en" | "clear" | null {
  const t = text.toLowerCase();
  if (/(only|just|always)\s+(speak|reply|respond|talk|write)\s+(in\s+)?english/.test(t) ||
      /respond\s+only\s+in\s+english/.test(t) ||
      /english\s+only\b/.test(t)) return "en";
  if (/(only|just|always)\s+(speak|reply|respond|talk|write)\s+(in\s+)?arabic/.test(t) ||
      /respond\s+only\s+in\s+arabic/.test(t) ||
      /arabic\s+only\b/.test(t)) return "ar";
  if (/تكلم\s+(عربي|بالعربي|بالعربية)\s+(فقط|بس)/.test(text) ||
      /(رد|جاوب)\s+(بالعربي|بالعربية)\s+(فقط|بس)?/.test(text)) return "ar";
  if (/تكلم\s+(انجليزي|إنجليزي|بالإنجليزية|بالانجليزية)\s+(فقط|بس)?/.test(text) ||
      /(رد|جاوب)\s+(بالانجليزي|بالإنجليزي|بالإنجليزية)\s+(فقط|بس)?/.test(text)) return "en";
  if (/no\s+language\s+lock|stop\s+forcing\s+language|auto[- ]detect\s+language/.test(t) ||
      /اوقف\s+القفل|تلقائي/.test(text)) return "clear";
  return null;
}

export function ChatWorkspace({ threadId }: { threadId?: string } = {}) {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  // IMPORTANT: keep initial state SSR-safe — reading sessionStorage in the
  // initializer causes a server/client hydration mismatch (React #418) which
  // blanks the whole page. Hydrate after mount instead.
  const [convs, setConvs] = useState<Conv[]>([]);
  const [forcedLang, setForcedLang] = useState<"ar" | "en" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setConvs(loadConvs());
    const v = sessionStorage.getItem(FORCED_LANG_KEY);
    if (v === "ar" || v === "en") setForcedLang(v);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    if (forcedLang) sessionStorage.setItem(FORCED_LANG_KEY, forcedLang);
    else sessionStorage.removeItem(FORCED_LANG_KEY);
  }, [forcedLang, hydrated]);

  // Keep refs so values used inside sendMessage body are always current
  const forcedLangRef = useRef(forcedLang);
  const langRef = useRef(lang);
  useEffect(() => { forcedLangRef.current = forcedLang; }, [forcedLang]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Keep sessionStorage in sync (only after we've hydrated, otherwise the
  // first effect would overwrite stored chats with [] on mount).
  useEffect(() => { if (hydrated) saveConvs(convs); }, [convs, hydrated]);

  // Active conversation id — decoupled from the URL so the first message
  // does NOT cause a route remount that loses the streaming state.
  const [activeId, setActiveId] = useState<string | undefined>(threadId);
  useEffect(() => { setActiveId(threadId); }, [threadId]);

  const currentConv = useMemo(
    () => (activeId ? convs.find((c) => c.id === activeId) : undefined),
    [convs, activeId],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            forcedLang: forcedLangRef.current,
            preferredLang: langRef.current,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: activeId ?? "new",
    messages: currentConv?.messages ?? [],
    transport,
    onError: (e) => toast.error(e.message),
    onFinish: ({ message }) => {
      const tid = activeId;
      if (!tid) return;
      const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
      if (!text) return;
      setConvs((prev) =>
        prev.map((c) =>
          c.id === tid
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

  // Hydrate messages when the URL thread changes (user clicked a sidebar item)
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

    // Detect explicit language-lock commands from the user
    const cmd = detectForcedLang(text);
    if (cmd === "clear") setForcedLang(null);
    else if (cmd === "ar" || cmd === "en") {
      setForcedLang(cmd);
      setLang(cmd);
    }

    let convId = activeId;
    if (!convId) {
      convId = newId();
      const newConv: Conv = {
        id: convId,
        title: text.slice(0, 60),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      setConvs((prev) => [newConv, ...prev]);
      setActiveId(convId);
      // Update the URL without remounting the route — preserves the
      // in-flight stream and prevents duplicate conversation creation.
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/chat/${convId}`);
      }
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
  }, [input, user, isLoading, activeId, sendMessage, setLang]);

  const onDelete = (id: string) => {
    setConvs((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(undefined);
      navigate({ to: "/chat" });
    }
  };

  const sortedConvs = [...convs].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const filteredConvs = sortedConvs.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen">
      {/* Conversations sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-e bg-sidebar/50 p-3 lg:flex">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/" })}
          className="mb-2 w-full justify-start border-electric/40 text-foreground hover:border-electric hover:bg-electric/10"
          title={lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
        >
          <Home className="me-2 h-4 w-4 text-electric" />
          {lang === "ar" ? "الصفحة الرئيسية" : "Home"}
        </Button>
        <Button
          onClick={() => {
            setActiveId(undefined);
            setMessages([]);
            navigate({ to: "/chat" });
          }}
          className="mb-3 w-full justify-start glow-electric"
        >
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
              <div key={c.id} className={`group flex items-center rounded-lg px-2 py-1.5 text-sm transition ${activeId === c.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}>
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
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="inline-flex rounded-full border border-electric/30 bg-secondary/40 p-0.5">
                <button
                  type="button"
                  onClick={() => { setLang("ar"); setForcedLang("ar"); }}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === "ar"
                      ? "bg-primary text-primary-foreground shadow-[0_0_18px_2px_rgba(64,180,255,0.55)]"
                      : lang === "ar" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={forcedLang === "ar"}
                  title="العربية"
                >العربية</button>
                <button
                  type="button"
                  onClick={() => { setLang("en"); setForcedLang("en"); }}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === "en"
                      ? "bg-primary text-primary-foreground shadow-[0_0_18px_2px_rgba(64,180,255,0.55)]"
                      : lang === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={forcedLang === "en"}
                  title="English"
                >English</button>
                <button
                  type="button"
                  onClick={() => setForcedLang(null)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={lang === "ar" ? "تلقائي" : "Auto"}
                >{lang === "ar" ? "تلقائي" : "Auto"}</button>
              </div>
              <span className="opacity-70">
                {lang === "ar"
                  ? forcedLang
                    ? `مقفول على ${forcedLang === "ar" ? "العربية" : "الإنجليزية"} · اضغط Enter للإرسال`
                    : "وضع تلقائي — أسترا تتبع لغتك · Enter للإرسال"
                  : forcedLang
                    ? `Locked to ${forcedLang === "ar" ? "Arabic" : "English"} · Enter to send`
                    : "Auto mode — Astra follows your language · Enter to send"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
