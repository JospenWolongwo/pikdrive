"use client";

import type {
  OfflineAction,
  OfflineActionHandler,
  OfflineActionHandlerMap,
} from "@/stores";
import type { CreateBookingRequest, RideWithDetails } from "@/types";

export interface ApiRequestPayload {
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly url: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export interface BookingIntentPayload extends CreateBookingRequest {
  readonly user_id: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const fetchJson = async <T>(url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return undefined as T;
};

const isApiRequestPayload = (payload: unknown): payload is ApiRequestPayload => {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as ApiRequestPayload;
  return (
    (candidate.method === "POST" ||
      candidate.method === "PUT" ||
      candidate.method === "PATCH" ||
      candidate.method === "DELETE") &&
    typeof candidate.url === "string"
  );
};

const isBookingIntentPayload = (
  payload: unknown
): payload is BookingIntentPayload => {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as BookingIntentPayload;
  return (
    typeof candidate.ride_id === "string" &&
    typeof candidate.user_id === "string" &&
    typeof candidate.seats === "number"
  );
};

const handleApiRequest: OfflineActionHandler = async (action: OfflineAction) => {
  if (!isApiRequestPayload(action.payload)) {
    throw new Error("Invalid api request payload");
  }

  const { method, url, body, headers } = action.payload;

  if (!url.startsWith("/")) {
    throw new Error("Offline queue only supports relative URLs");
  }

  const json = await fetchJson<ApiResponse>(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (json && json.success === false) {
    throw new Error(json.error || json.message || "Request failed");
  }
};

const handleBookingIntent: OfflineActionHandler = async (
  action: OfflineAction
) => {
  if (!isBookingIntentPayload(action.payload)) {
    throw new Error("Invalid booking intent payload");
  }

  const { ride_id, user_id, seats } = action.payload;

  const existing = await fetchJson<ApiResponse>(
    `/api/bookings/existing?rideId=${encodeURIComponent(
      ride_id
    )}&userId=${encodeURIComponent(user_id)}`
  );

  if (existing?.success && existing.data) {
    return;
  }

  const rideResponse = await fetchJson<ApiResponse<RideWithDetails>>(
    `/api/rides/${encodeURIComponent(ride_id)}`
  );

  if (!rideResponse?.success || !rideResponse.data) {
    throw new Error(rideResponse?.error || "Ride not found");
  }

  if (rideResponse.data.seats_available < seats) {
    throw new Error("Insufficient seats available");
  }

  const bookingResponse = await fetchJson<ApiResponse>("/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action.payload),
  });

  if (!bookingResponse?.success) {
    throw new Error(
      bookingResponse?.error || bookingResponse?.message || "Booking failed"
    );
  }
};

export const offlineActionHandlers: OfflineActionHandlerMap = {
  "api.request": handleApiRequest,
  "booking.intent": handleBookingIntent,
};
