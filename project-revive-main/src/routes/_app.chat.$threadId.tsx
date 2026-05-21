import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/features/chat/ChatWorkspace";

export const Route = createFileRoute("/_app/chat/$threadId")({
  head: () => ({ meta: [{ title: "Chat — Astra Intelligence" }] }),
  component: ChatRoute,
});

function ChatRoute() {
  const { threadId } = Route.useParams();
  return <ChatWorkspace key={threadId} threadId={threadId} />;
}
