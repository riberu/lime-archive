import { AppShell } from "@/components/app-shell";
import { ChatRoom } from "@/components/chat-room";
import { getMessages, getSession, getStory } from "@/lib/data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const story = await getStory(session.storyId);
  if (!story) notFound();

  const messages = await getMessages(session.id);

  return (
    <AppShell>
      <ChatRoom initialMessages={messages} session={session} story={story} />
    </AppShell>
  );
}
