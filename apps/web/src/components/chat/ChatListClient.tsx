"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, Plus, Search, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/lib/i18n/formatDate";

interface Conversation {
  id: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; title: string; price: number; currency: string } | null;
  last_message: {
    id: number;
    body: string;
    created_at: string;
    // nullable after GDPR erasure (tombstoned messages have author_id=null)
    author_id: string | null;
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
  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

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
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <section className="rounded-md border border-border/80 bg-card p-6 shadow-sm">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" aria-hidden="true" />
            </div>
            <Badge variant="secondary" className="mb-3">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {translate("chat.empty.badge", "Safe conversations")}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">
              {translate("chat.empty.title", "No conversations yet")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {translate(
                "chat.empty.description",
                "When you message a seller from a listing, the conversation will appear here with the advert context and safety history.",
              )}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/search">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {translate("chat.empty.find_listing", "Find listings")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/post">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {translate("chat.empty.post_listing", "Post advert")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {translate("chat.safety_badge", "In-platform deal record")}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            {translate("chat.title", "Messages")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(
              "chat.subtitle",
              "Keep seller questions, payment decisions, and delivery details inside LyVoX.",
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/search">
            <Search className="h-4 w-4" aria-hidden="true" />
            {translate("chat.find_listing", "Find listings")}
          </Link>
        </Button>
      </header>

      <div className="space-y-3">
        {conversations.map((conversation) => {
          const unread = hasUnread(conversation);
          const peerName = conversation.peer?.display_name || translate("chat.unknown_user", "LyVoX user");
          const messagePreview = conversation.last_message
            ? formatMessagePreview(conversation.last_message.body)
            : translate("chat.no_messages", "No messages yet");
          const advertPrice =
            conversation.advert?.price !== undefined && conversation.advert?.price !== null
              ? formatCurrency(conversation.advert.price, locale, conversation.advert.currency || "EUR")
              : null;

          return (
            <Link key={conversation.id} href={`/chat/${conversation.id}`}>
              <Card
                className={`rounded-md py-0 transition-colors hover:bg-muted/40 ${
                  unread ? "border-primary/70 ring-1 ring-primary/20" : "border-border/80"
                }`}
              >
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
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm text-muted-foreground">
                            {conversation.advert.title}
                          </p>
                          {advertPrice ? (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                              {advertPrice}
                            </span>
                          ) : null}
                        </div>
                      )}
                      <p className={`text-sm truncate ${unread ? "font-medium" : "text-muted-foreground"}`}>
                        {messagePreview}
                      </p>
                    </div>
                    {unread ? (
                      <div className="mt-1 flex shrink-0 items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
                      </div>
                    ) : (
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
