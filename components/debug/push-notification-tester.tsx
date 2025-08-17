"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/providers/SupabaseProvider";

export function PushNotificationTester() {
  const [title, setTitle] = useState("Test Notification");
  const [body, setBody] = useState("This is a test push notification");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useSupabase();

  const testPushNotification = async () => {
    if (!user) {
      toast({
        title: "Erreur",
        description:
          "Vous devez être connecté pour tester les notifications push.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          title,
          body,
          data: {
            type: "test",
            timestamp: Date.now(),
          },
          icon: "/icons/icon-192x192.png",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "✅ Notification envoyée",
          description:
            result.message ||
            `Envoyée à ${result.successful}/${result.total} appareils`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "❌ Erreur",
          description: error.error || "Impossible d'envoyer la notification",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Test notification error:", error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors de l'envoi de la notification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testLocalNotification = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Non supporté",
        description:
          "Les notifications ne sont pas supportées dans ce navigateur",
        variant: "destructive",
      });
      return;
    }

    if (Notification.permission !== "granted") {
      toast({
        title: "Permission requise",
        description: "Veuillez d'abord autoriser les notifications",
        variant: "destructive",
      });
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        data: {
          type: "test",
          timestamp: Date.now(),
        },
      });

      toast({
        title: "✅ Notification locale",
        description: "Notification locale affichée avec succès",
      });
    } catch (error) {
      console.error("Local notification error:", error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors de l'affichage de la notification locale",
        variant: "destructive",
      });
    }
  };

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Testeur de Notifications Push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Titre</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la notification"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Input
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message de la notification"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testLocalNotification}
            variant="outline"
            className="flex-1"
          >
            Test Local
          </Button>
          <Button
            onClick={testPushNotification}
            disabled={loading || !user}
            className="flex-1"
          >
            {loading ? "Envoi..." : "Test Push"}
          </Button>
        </div>

        {!user && (
          <p className="text-sm text-muted-foreground text-center">
            Connectez-vous pour tester les notifications push
          </p>
        )}
      </CardContent>
    </Card>
  );
}
