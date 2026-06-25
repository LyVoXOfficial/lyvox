import { supabaseServer } from "@/lib/supabaseServer";
import { redirect, notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import ChatWindow from "@/components/chat/ChatWindow";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface ChatPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/chat/${conversationId}`)}`);
  }

  // Verify user is a participant
  const { data: participant, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (participantError || !participant) {
    notFound();
  }

  // Load conversation details
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(
      `
      id,
      created_by,
      advert_id,
      adverts (
        id,
        title,
        price,
        currency
      )
    `,
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    notFound();
  }

  // Get peer information
  const { data: peerParticipant } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: peerProfile } = peerParticipant
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", peerParticipant.user_id)
        .maybeSingle()
    : { data: null };

  const peer = peerParticipant
    ? {
        id: peerParticipant.user_id,
        display_name: peerProfile?.display_name ?? null,
      }
    : null;

  // Load initial messages (last 50)
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, conversation_id, author_id, body, created_at, updated_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (messagesError) {
    console.error("Error loading messages:", messagesError);
  }

  // Reverse to get chronological order (oldest first)
  const sortedMessages = (messages || [])
    .reverse()
    .map((message) => ({
      ...message,
      created_at: message.created_at ?? new Date().toISOString(),
      updated_at: message.updated_at ?? undefined,
    }));

  const { messages: i18nMessages } = await getI18nProps();

  return (
    <ChatWindow
      conversationId={conversationId}
      peer={peer}
      advert={conversation.adverts as { id: string; title: string; price: number; currency: string } | null}
      initialMessages={sortedMessages}
      currentUserId={user.id}
      messages={i18nMessages}
    />
  );
}
