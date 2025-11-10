import dynamic from "next/dynamic";
import { supabaseServer } from "@/lib/supabaseServer";
import { redirect, notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";

// PERF-003: Lazy load ChatWindow (heavy component with realtime subscriptions)
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow"), {
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading chat...</div>
    </div>
  ),
  ssr: false, // Client-only component with realtime
});

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
    redirect("/login");
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
  const { data: peers } = await supabase
    .from("conversation_participants")
    .select("user_id, profiles!inner(id, display_name)")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const peer = peers?.profiles
    ? {
        id: peers.user_id,
        display_name: (peers.profiles as { id: string; display_name: string | null }).display_name,
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
  const sortedMessages = (messages || []).reverse();

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

