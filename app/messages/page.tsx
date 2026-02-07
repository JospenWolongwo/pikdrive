"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import type { UIConversation } from "@/types";
import { getAvatarUrl } from "@/lib/utils/avatar-url";
import { Button, Input, Card, CardContent, Badge, Avatar, AvatarFallback, AvatarImage, Tabs, TabsContent, TabsList, TabsTrigger, Skeleton } from "@/components/ui";
import {
  Search,
  MessageCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { ChatDialog } from "@/components/chat";
import { useNotificationPromptTrigger } from "@/hooks";

import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useUserRides, useToast, useServiceWorker, useLocale } from "@/hooks";

// Use UIConversation type from types/chat.ts

export default function MessagesPage() {
  const router = useRouter();
  const { user, supabase } = useSupabase();
  const { t } = useLocale();
  const {
    conversations,
    conversationsError,
    unreadCounts,
    fetchConversations,
    fetchUnreadCounts,
    markAsRead,
    subscribeToAllConversations,
    unsubscribeFromAllConversations,
  } = useChatStore();
  const { toast } = useToast();
  const { userRides, userRidesLoading, userRidesError, loadUserRides } = useUserRides();
  const [selectedChat, setSelectedChat] = useState<UIConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationsReady, setConversationsReady] = useState(false);
  
  // Track if conversations have been loaded to prevent unnecessary refetches
  const conversationsLoadedRef = useRef(false);

  // Service worker and push notification hooks
  const {
    isSupported: swSupported,
    isRegistered: swRegistered,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
  } = useServiceWorker();

  // Notification prompt trigger
  const { triggerPrompt } = useNotificationPromptTrigger();

  // Note: Notifications are handled by OneSignal via server-side API

  // Note: Unread counts are now handled by the chatStore automatically

  // Note: Real-time updates are now handled by the chatStore automatically

  // Handle URL parameters for opening specific conversations
  // Open chat with a specific user - wrapped in useCallback to prevent re-renders
  const openChat = useCallback(
    (conversation: UIConversation) => {
      setSelectedChat(conversation);

      // Mark messages as read when opening the chat
      if (conversation.unreadCount > 0 && user) {
        markAsRead(conversation.id, user.id);
      }
    },
    [markAsRead, user]
  );

  const [urlParams, setUrlParams] = useState<{
    rideId?: string;
    userId?: string;
  }>({});

  // Extract URL parameters - only run once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const rideId = params.get("ride");
      const userId = params.get("user");

      if (rideId && userId) {
        setUrlParams({ rideId, userId });

        // Clean URL parameters immediately
        const url = new URL(window.location.href);
        url.searchParams.delete("ride");
        url.searchParams.delete("user");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  // Process URL parameters after conversations are loaded
  useEffect(() => {
    if (
      user &&
      urlParams.rideId &&
      urlParams.userId &&
      conversations.length > 0
    ) {
      // Find the conversation that matches the ride ID and user ID
      const conversation = conversations.find(
        (conv) =>
          conv.rideId === urlParams.rideId &&
          conv.otherUserId === urlParams.userId
      );

      if (conversation) {
        openChat(conversation);

        // Clear URL params after handling
        setUrlParams({});
      }
    }
  }, [user, conversations, urlParams, openChat]);

  // Load conversations on mount and when user changes
  useEffect(() => {
    if (!user) {
      conversationsLoadedRef.current = false; // Reset when user logs out
      setConversationsReady(false);
      return;
    }
    
    const loadConversations = async () => {
      try {
        // Load user rides using Zustand store (non-blocking)
        loadUserRides(user.id).catch(() => {
          // Don't show error toast for rides - conversations are more important
        });
        
        // Fetch unread counts
        await fetchUnreadCounts(user.id);
        
        // Only fetch conversations if not already loaded (caching)
        if (!conversationsLoadedRef.current) {
          await fetchConversations(user.id);
          conversationsLoadedRef.current = true;
        }
      } catch (error) {
        toast({
          title: "Erreur de chargement",
          description:
            "Impossible de charger vos conversations. Veuillez réessayer.",
          variant: "destructive",
        });
      } finally {
        setConversationsReady(true);
      }
    };

    loadConversations();
  }, [user, loadUserRides, fetchConversations, fetchUnreadCounts, toast]); // Remove conversations from deps to prevent infinite loop

  // Trigger notification prompt when user visits messages page (only in browser)
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      // Small delay to let the page load
      const timer = setTimeout(() => {
        triggerPrompt();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [user, triggerPrompt]);

  // Subscribe to all conversations for real-time updates
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to all conversations with a single global subscription
    subscribeToAllConversations(user.id);
    
    return () => {
      // Cleanup global subscription
      unsubscribeFromAllConversations();
    };
  }, [user, subscribeToAllConversations, unsubscribeFromAllConversations]);

  // Note: Unread counts and conversation updates are now handled by the chatStore automatically

  // Memoized conversation filtering to prevent unnecessary re-computations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.otherUserName.toLowerCase().includes(query) ||
        conv.ride.from_city.toLowerCase().includes(query) ||
        conv.ride.to_city.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );
  }, [searchQuery, conversations]);

  // Note: Message notification manager setup removed - handled by chatStore

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const showConversationsSkeleton = !conversationsReady;
  const showConversationsError = conversationsReady && !!conversationsError;
  const dateFnsLocale = locale === "fr" ? fr : enUS;

  const conversationSkeletons = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("common.loading")}...</p>
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-4 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="min-w-0 flex-1 overflow-hidden space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex flex-col space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{t("pages.messages.title")}</h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("pages.messages.searchPlaceholder")}
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">{t("pages.messages.tabs.all")}</TabsTrigger>
            <TabsTrigger value="unread">
              {t("pages.messages.tabs.unread")}
              {unreadCounts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCounts.reduce((sum, item) => sum + item.count, 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {showConversationsSkeleton ? (
              conversationSkeletons
            ) : showConversationsError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {t("pages.messages.errorLoading")}
                  </h3>
                  <p className="text-muted-foreground text-center mt-2">
                    {t("pages.messages.errorDescription")}
                  </p>
                </CardContent>
              </Card>
            ) : filteredConversations.length > 0 ? (
              <div className="space-y-4">
                {filteredConversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      conversation.unreadCount > 0
                        ? "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => openChat(conversation)}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={getAvatarUrl(supabase, conversation.otherUserAvatar)}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {conversation.otherUserName[0]?.toUpperCase() ||
                              "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-medium text-lg truncate">
                              {conversation.otherUserName}
                            </h3>
                            {conversation.unreadCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="shrink-0 px-2"
                              >
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage}
                          </p>
                          <div className="flex items-center flex-nowrap gap-2 mt-1 text-xs text-muted-foreground min-w-0">
                            <div className="flex items-center min-w-0 shrink overflow-hidden">
                              <Clock className="mr-1 h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {formatDistanceToNow(
                                  new Date(conversation.lastMessageTime),
                                  { addSuffix: true, locale: dateFnsLocale }
                                )}
                              </span>
                            </div>
                            <span className="shrink-0">•</span>
                            <div className="flex items-center min-w-0 flex-1 truncate">
                              <ArrowRight className="mr-1 h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {conversation.ride.from_city} → {conversation.ride.to_city}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        {t("pages.messages.open")}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  {searchQuery ? (
                    <>
                      <h3 className="text-lg font-medium">
                        {t("pages.messages.noResults")}
                      </h3>
                      <p className="text-muted-foreground text-center mt-2">
                        {t("pages.messages.noResultsDescription")}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium">
                        {t("pages.messages.noConversations")}
                      </h3>
                      <p className="text-muted-foreground text-center mt-2">
                        {t("pages.messages.noConversationsDescription")}
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => router.push("/rides")}
                      >
                        {t("pages.messages.findRides")}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {showConversationsSkeleton ? (
              conversationSkeletons
            ) : showConversationsError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {t("pages.messages.errorLoading")}
                  </h3>
                  <p className="text-muted-foreground text-center mt-2">
                    {t("pages.messages.errorDescription")}
                  </p>
                </CardContent>
              </Card>
            ) : filteredConversations.filter((c) => c.unreadCount > 0).length >
              0 ? (
              <div className="space-y-4">
                {filteredConversations
                  .filter((c) => c.unreadCount > 0)
                  .map((conversation) => (
                    <Card
                      key={conversation.id}
                      className="cursor-pointer transition-all hover:shadow-md bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                      onClick={() => openChat(conversation)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage
                              src={getAvatarUrl(supabase, conversation.otherUserAvatar)}
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {conversation.otherUserName[0]?.toUpperCase() ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="font-medium text-lg truncate">
                                {conversation.otherUserName}
                              </h3>
                              <Badge
                                variant="destructive"
                                className="shrink-0 px-2"
                              >
                                {conversation.unreadCount}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.lastMessage}
                            </p>
                            <div className="flex items-center flex-nowrap gap-2 mt-1 text-xs text-muted-foreground min-w-0">
                              <div className="flex items-center min-w-0 shrink overflow-hidden">
                                <Clock className="mr-1 h-3 w-3 shrink-0" />
                                <span className="truncate">
                                {formatDistanceToNow(
                                  new Date(conversation.lastMessageTime),
                                  { addSuffix: true, locale: dateFnsLocale }
                                )}
                                </span>
                              </div>
                              <span className="shrink-0">•</span>
                              <div className="flex items-center min-w-0 flex-1 truncate">
                                <ArrowRight className="mr-1 h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {conversation.ride.from_city} → {conversation.ride.to_city}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          {t("pages.messages.open")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {t("pages.messages.noUnread")}
                  </h3>
                  <p className="text-muted-foreground text-center mt-2">
                    {t("pages.messages.noUnreadDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedChat && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat(null)}
          rideId={selectedChat.rideId}
          conversationId={selectedChat.id}
          otherUserId={selectedChat.otherUserId}
          otherUserName={selectedChat.otherUserName}
          otherUserAvatar={selectedChat.otherUserAvatar || undefined}
        />
      )}
    </div>
  );
}
