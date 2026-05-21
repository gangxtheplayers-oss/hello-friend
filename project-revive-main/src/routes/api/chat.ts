import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are Astra, a premium multilingual AI assistant.
You are fluent in English and Arabic, including Modern Standard Arabic, Egyptian Arabic, informal Arabic dialects, and mixed Arabic-English speech.

Rules:
- Detect the user's language automatically and reply in the SAME language.
- For mixed Arabic-English input, mirror the user's mixing style naturally.
- Use Markdown for structure (lists, code blocks, bold) when helpful.
- Be concise, warm, and intelligent. Preserve the user's tone.
- Use RTL-friendly punctuation when responding in Arabic.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as { messages?: UIMessage[] };
          const messages = body.messages;
          if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const result = streamText({
            model,
            system: SYSTEM,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
          });
          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (e) {
          console.error("/api/chat error", e);
          const msg = e instanceof Error ? e.message : "Unknown error";
          return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
