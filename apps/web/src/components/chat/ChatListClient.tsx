"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; title: string; price: number; currency: string } | null;
  last_message: {
    id: number;
    body: string;
    created_at: string;
    author_id: string;
  } | null;
  last_message_at: string | null;
  created_at: string;
  last_read_at: string | null;
}

interface ChatListClientProps {
  conversations: Conversation[];
  messages: Record<string, any>;
}

export default function ChatListClient({ conversations }: ChatListClientProps) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessagePreview = (body: string, maxLength = 50) => {
    if (body.length <= maxLength) return body;
    return body.slice(0, maxLength) + "...";
  };

  const hasUnread = (conversation: Conversation) => {
    if (!conversation.last_message) return false;
    if (!conversation.last_read_at) return true;
    return new Date(conversation.last_message.created_at) > new Date(conversation.last_read_at);
  };

  if (conversations.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t("chat.empty.title")}</h2>
          <p className="text-muted-foreground">{t("chat.empty.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("chat.title")}</h1>
      <div className="space-y-2">
        {conversations.map((conversation) => {
          const unread = hasUnread(conversation);
          const peerName = conversation.peer?.display_name || t("chat.unknown_user");
          const messagePreview = conversation.last_message
            ? formatMessagePreview(conversation.last_message.body)
            : t("chat.no_messages");

          return (
            <Link key={conversation.id} href={`/chat/${conversation.id}`}>
              <Card className={`hover:bg-muted/50 transition-colors ${unread ? "border-primary" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="" />
                      <AvatarFallback>{getInitials(peerName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate">{peerName}</h3>
                        {conversation.last_message_at && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatDate(conversation.last_message_at, locale, "relative")}
                          </span>
                        )}
                      </div>
                      {conversation.advert && (
                        <p className="text-sm text-muted-foreground mb-1 truncate">
                          {conversation.advert.title}
                        </p>
                      )}
                      <p className={`text-sm truncate ${unread ? "font-medium" : "text-muted-foreground"}`}>
                        {messagePreview}
                      </p>
                    </div>
                    {unread && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

