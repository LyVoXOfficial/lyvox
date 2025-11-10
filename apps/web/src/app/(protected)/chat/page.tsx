import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import ChatListClient from "@/components/chat/ChatListClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ChatListPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load conversations for the user
  const { data: conversations, error } = await supabase
    .from("conversation_participants")
    .select(
      `
      conversation_id,
      last_read_at,
      conversations (
        id,
        created_by,
        advert_id,
        last_message_at,
        created_at,
        adverts (
          id,
          title,
          price,
          currency
        )
      )
    `,
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    console.error("Error loading conversations:", error);
  }

  // Get peer information for each conversation
  const conversationsWithPeers = await Promise.all(
    (conversations || []).map(async (participant) => {
      const conv = participant.conversations as {
        id: string;
        created_by: string;
        advert_id: string | null;
        last_message_at: string | null;
        created_at: string;
        adverts?: { id: string; title: string; price: number; currency: string } | null;
      };

      // Get the other participant
      const { data: peers } = await supabase
        .from("conversation_participants")
        .select("user_id, profiles!inner(id, display_name)")
        .eq("conversation_id", conv.id)
        .neq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      // Get last message
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("id, body, created_at, author_id")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: conv.id,
        peer: peers?.profiles
          ? {
              id: peers.user_id,
              display_name: (peers.profiles as { id: string; display_name: string | null })
                .display_name,
            }
          : null,
        advert: conv.adverts || null,
        last_message: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              created_at: lastMessage.created_at,
              author_id: lastMessage.author_id,
            }
          : null,
        last_message_at: conv.last_message_at,
        created_at: conv.created_at,
        last_read_at: participant.last_read_at,
      };
    }),
  );

  const { messages } = await getI18nProps();

  return <ChatListClient conversations={conversationsWithPeers} messages={messages} />;
}

