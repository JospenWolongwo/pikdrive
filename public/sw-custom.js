// Custom Service Worker for PikDrive Push Notifications
// This works alongside the generated service worker from next-pwa

const CACHE_NAME = "pikdrive-push-v1";
const OFFLINE_URL = "/offline";

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  console.log("🔧 PikDrive Service Worker installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/offline",
        "/icons/icon-192x192.png",
        "/icons/icon-512x512.png",
        "/manifest.json",
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 PikDrive Service Worker activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification event
self.addEventListener("push", (event) => {
  console.log("📱 Push notification received:", event);

  let notificationData = {
    title: "PikDrive",
    body: "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "open",
        title: "Open App",
        icon: "/icons/icon-72x72.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/icons/icon-72x72.png",
      },
    ],
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: { ...notificationData.data, ...data.data },
        actions: data.actions || notificationData.actions,
      };
    } catch (error) {
      console.error("Failed to parse push data:", error);
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notification clicked:", event);

  event.notification.close();

  if (event.action === "open" || event.action === "explore") {
    // Open the app to the specific page if data is available
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            // Focus existing window
            const client = clientList[0];
            client.focus();

            // Navigate to specific page if data is available
            if (event.notification.data?.url) {
              client.navigate(event.notification.data.url);
            } else if (event.notification.data?.messageId) {
              client.navigate(
                `/messages?messageId=${event.notification.data.messageId}`
              );
            }
          } else {
            // Open new window
            let url = "/";
            if (event.notification.data?.url) {
              url = event.notification.data.url;
            } else if (event.notification.data?.messageId) {
              url = `/messages?messageId=${event.notification.data.messageId}`;
            }
            clients.openWindow(url);
          }
        })
    );
  } else if (event.action === "close") {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(clients.openWindow("/"));
  }
});

// Background sync for offline transactions
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync event:", event.tag);

  if (event.tag === "sync-transactions") {
    event.waitUntil(syncOfflineTransactions());
  } else if (event.tag === "sync-messages") {
    event.waitUntil(syncOfflineMessages());
  }
});

// Handle offline transactions sync
async function syncOfflineTransactions() {
  try {
    console.log("💾 Syncing offline transactions...");

    // Get offline transactions from IndexedDB or send message to main thread
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_OFFLINE_TRANSACTIONS",
      });
    });
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Handle offline messages sync
async function syncOfflineMessages() {
  try {
    console.log("💬 Syncing offline messages...");

    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_OFFLINE_MESSAGES",
      });
    });
  } catch (error) {
    console.error("Message sync failed:", error);
  }
}

// Message event for communication with main thread
self.addEventListener("message", (event) => {
  console.log("📨 Service Worker received message:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch event - handle offline scenarios
self.addEventListener("fetch", (event) => {
  // Only handle navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return offline page for failed navigation requests
        return caches.match(OFFLINE_URL);
      })
    );
  }
});

console.log("🔧 PikDrive Custom Service Worker loaded successfully");
