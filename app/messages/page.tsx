"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChat } from "@/providers/ChatProvider";
import { ChatDialog } from "@/components/chat/chat-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell,
  MessageCircle,
  Clock,
  User,
  Search,
  ArrowRight,
  BellOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
interface Conversation {
  id: string;
  rideId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  ride: {
    from_city: string;
    to_city: string;
    departure_time: string;
  };
}

export default function MessagesPage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { unreadCounts, markAsRead, subscribeToRide } = useChat();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  
  // Check if notifications are supported
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsSupported(true);
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  // Request notifications permission
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Notifications non supportées",
        description: "Votre navigateur ne supporte pas les notifications.",
        variant: "destructive",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      
      if (permission === "granted") {
        toast({
          title: "Notifications activées",
          description: "Vous recevrez des notifications pour les nouveaux messages.",
        });
      } else {
        toast({
          title: "Notifications bloquées",
          description: "Veuillez autoriser les notifications dans les paramètres de votre navigateur.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'activer les notifications. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("📥 Loading conversations...");

      // First, get all rides where the user is a driver or passenger
      const { data: userRides, error: ridesError } = await supabase
        .from("rides")
        .select(`
          id,
          from_city,
          to_city, 
          departure_time,
          driver_id,
          bookings!inner (
            id,
            user_id,
            ride_id
          )
        `)
        .or(`driver_id.eq.${user.id},bookings.user_id.eq.${user.id}`);

      if (ridesError) throw ridesError;

      // Define ride type to avoid implicit any errors
      interface RideInfo {
        id: string;
        from_city: string;
        to_city: string;
        departure_time: string;
        [key: string]: any; // For any other properties
      }
      
      // Then get the most recent message for each ride
      if (userRides && userRides.length > 0) {
        const rideIds = userRides.map((ride: RideInfo) => ride.id);

        // Subscribe to all ride channels for real-time updates
        rideIds.forEach((rideId: string) => {
          subscribeToRide(rideId);
        });

        // Get the last message for each ride
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select(`
            id,
            content,
            created_at,
            ride_id,
            sender_id,
            receiver_id,
            sender:profiles!messages_sender_id_fkey (
              id,
              full_name,
              avatar_url
            ),
            receiver:profiles!messages_receiver_id_fkey (
              id,
              full_name,
              avatar_url
            )
          `)
          .in("ride_id", rideIds)
          .order("created_at", { ascending: false });

        if (messagesError) throw messagesError;

        // Define message interface to avoid implicit any errors
        interface MessageData {
          id: string;
          content: string;
          created_at: string;
          ride_id: string;
          sender_id: string;
          receiver_id: string;
          sender: {
            id: string;
            full_name: string;
            avatar_url: string | null;
          };
          receiver: {
            id: string;
            full_name: string;
            avatar_url: string | null;
          };
          [key: string]: any; // For any other properties
        }
          
        if (messages && messages.length > 0) {
          // Group messages by ride_id to find the most recent one for each ride
          const lastMessageByRide: Record<string, MessageData> = {};
          
          messages.forEach((message: MessageData) => {
            if (!lastMessageByRide[message.ride_id]) {
              lastMessageByRide[message.ride_id] = message;
            }
          });

          // Build conversations array
          const conversationsArray: Conversation[] = Object.values(lastMessageByRide).map((message: MessageData) => {
            // Determine which ride this message belongs to
            const ride = userRides.find((r: RideInfo) => r.id === message.ride_id);
            
            // Determine the other user (not the current user)
            const isCurrentUserSender = message.sender_id === user.id;
            const otherUser = isCurrentUserSender ? message.receiver : message.sender;
            
            // Get unread count for this ride
            const unreadCount = unreadCounts.find((count) => count.rideId === message.ride_id)?.count || 0;

            return {
              id: message.id,
              rideId: message.ride_id,
              otherUserId: otherUser.id,
              otherUserName: otherUser.full_name,
              otherUserAvatar: otherUser.avatar_url,
              lastMessage: message.content,
              lastMessageTime: message.created_at,
              unreadCount,
              ride: {
                from_city: ride?.from_city || "",
                to_city: ride?.to_city || "",
                departure_time: ride?.departure_time || "",
              },
            };
          });

          // Sort by latest message
          conversationsArray.sort((a, b) => 
            new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
          );

          setConversations(conversationsArray);
          setFilteredConversations(conversationsArray);
        }
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger vos conversations. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, unreadCounts, subscribeToRide, toast]);

  // Handle URL parameters for opening specific conversations
  // Open chat with a specific user - wrapped in useCallback to prevent re-renders
  const openChat = useCallback((conversation: Conversation) => {
    console.log(`📱 Opening chat with ${conversation.otherUserName} for ride ${conversation.rideId}`);
    setSelectedChat(conversation);
    
    // Mark messages as read when opening the chat
    if (conversation.unreadCount > 0) {
      markAsRead(conversation.rideId);
    }
  }, [markAsRead]);

  const [urlParams, setUrlParams] = useState<{rideId?: string, userId?: string}>({});
  
  // Extract URL parameters - only run once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const rideId = params.get("ride");
      const userId = params.get("user");
      
      if (rideId && userId) {
        console.log(`🔗 URL parameters detected: ride=${rideId}, user=${userId}`);
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
    if (user && urlParams.rideId && urlParams.userId && conversations.length > 0) {
      // Find the conversation that matches the ride ID and user ID
      const conversation = conversations.find(
        (conv) => conv.rideId === urlParams.rideId && conv.otherUserId === urlParams.userId
      );
      
      if (conversation) {
        console.log(`✅ Found conversation from URL parameters, opening chat`);
        openChat(conversation);
        
        // Clear URL params after handling
        setUrlParams({});
      } else {
        console.log(`⚠️ Conversation from URL parameters not found in loaded conversations`);
      }
    }
  }, [user, conversations, urlParams, openChat]);
  
  // Load conversations on mount and when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter(
      (conv) =>
        conv.otherUserName.toLowerCase().includes(query) ||
        conv.ride.from_city.toLowerCase().includes(query) ||
        conv.ride.to_city.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );

    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  // Set up real-time notification subscription
  useEffect(() => {
    if (!user || !notificationsEnabled) return;

    // Subscribe to new messages sent to this user
    const channel = supabase
      .channel("new-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newMessage = payload.new;
          
          // Show notification for new messages
          if (
            notificationsEnabled &&
            document.visibilityState !== "visible" &&
            newMessage.sender_id !== user.id
          ) {
            // Fetch sender info
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", newMessage.sender_id)
              .single()
              .then(({ data }: { data: { full_name: string } | null }) => {
                if (data) {
                  // Create notification
                  const notification = new Notification("Nouveau message", {
                    body: `${data.full_name}: ${newMessage.content}`,
                    icon: "/icon.png", // Make sure this path exists
                  });

                  // Handle notification click
                  notification.onclick = () => {
                    window.focus();
                    router.push(`/messages?ride=${newMessage.ride_id}`);
                  };
                }
              });
          }

          // Refresh conversations to include the new message
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, notificationsEnabled, supabase, router, loadConversations]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex flex-col space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Messages</h1>
          
          {notificationsSupported && (
            <Button
              variant={notificationsEnabled ? "outline" : "default"}
              size="sm"
              onClick={requestNotificationPermission}
              className="flex items-center gap-2"
            >
              {notificationsEnabled ? (
                <>
                  <BellOff className="h-4 w-4" />
                  Notifications activées
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Activer les notifications
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher des messages..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="unread">
              Non lus
              {unreadCounts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCounts.reduce((sum, item) => sum + item.count, 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="space-y-4">
                {filteredConversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      conversation.unreadCount > 0
                        ? "bg-blue-50 border-blue-200"
                        : ""
                    }`}
                    onClick={() => openChat(conversation)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conversation.otherUserAvatar || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {conversation.otherUserName[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center">
                            <h3 className="font-medium text-lg">
                              {conversation.otherUserName}
                            </h3>
                            {conversation.unreadCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-2 px-2"
                              >
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {conversation.lastMessage}
                          </p>
                          <div className="flex items-center mt-1 text-xs text-muted-foreground space-x-2">
                            <div className="flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDistanceToNow(
                                new Date(conversation.lastMessageTime),
                                { addSuffix: true, locale: fr }
                              )}
                            </div>
                            <span>•</span>
                            <div className="flex items-center">
                              <ArrowRight className="mr-1 h-3 w-3" />
                              {conversation.ride.from_city} → {conversation.ride.to_city}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="ml-auto">
                        Ouvrir
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
                      <h3 className="text-lg font-medium">Aucun résultat trouvé</h3>
                      <p className="text-muted-foreground text-center mt-2">
                        Aucune conversation ne correspond à votre recherche.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium">Aucune conversation</h3>
                      <p className="text-muted-foreground text-center mt-2">
                        Vous n'avez pas encore démarré de conversation.
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => router.push("/rides")}
                      >
                        Trouver des trajets
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : filteredConversations.filter((c) => c.unreadCount > 0).length > 0 ? (
              <div className="space-y-4">
                {filteredConversations
                  .filter((c) => c.unreadCount > 0)
                  .map((conversation) => (
                    <Card
                      key={conversation.id}
                      className="cursor-pointer transition-all hover:shadow-md bg-blue-50 border-blue-200"
                      onClick={() => openChat(conversation)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conversation.otherUserAvatar || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {conversation.otherUserName[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-lg">
                                {conversation.otherUserName}
                              </h3>
                              <Badge
                                variant="destructive"
                                className="ml-2 px-2"
                              >
                                {conversation.unreadCount}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate max-w-md">
                              {conversation.lastMessage}
                            </p>
                            <div className="flex items-center mt-1 text-xs text-muted-foreground space-x-2">
                              <div className="flex items-center">
                                <Clock className="mr-1 h-3 w-3" />
                                {formatDistanceToNow(
                                  new Date(conversation.lastMessageTime),
                                  { addSuffix: true, locale: fr }
                                )}
                              </div>
                              <span>•</span>
                              <div className="flex items-center">
                                <ArrowRight className="mr-1 h-3 w-3" />
                                {conversation.ride.from_city} → {conversation.ride.to_city}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-auto">
                          Ouvrir
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Pas de messages non lus</h3>
                  <p className="text-muted-foreground text-center mt-2">
                    Vous avez lu tous vos messages.
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
          otherUserId={selectedChat.otherUserId}
          otherUserName={selectedChat.otherUserName}
          otherUserAvatar={selectedChat.otherUserAvatar || undefined}
        />
      )}
    </div>
  );
}
