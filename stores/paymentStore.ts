import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Payment, CreatePaymentRequest, PaymentTransactionStatus } from "@/types";
import { paymentApiClient } from "@/lib/api-client/payment";
import { getVersionedStorageKey } from "@/lib/storage-version";

interface PaymentStatusResult {
  readonly success: boolean;
  readonly status: PaymentTransactionStatus;
  readonly message?: string;
}

interface PaymentState {
  // User payments state
  userPayments: Payment[];
  userPaymentsLoading: boolean;
  userPaymentsError: string | null;
  lastUserPaymentsFetch: number | null;

  // Current payment state (for status checking)
  currentPayment: Payment | null;
  currentPaymentLoading: boolean;
  currentPaymentError: string | null;

  // Payment creation state
  isCreatingPayment: boolean;
  createPaymentError: string | null;

  // Payment status checking state
  isCheckingStatus: boolean;
  checkStatusError: string | null;

  // Actions for user payments
  fetchUserPayments: (userId: string) => Promise<void>;
  refreshUserPayments: (userId: string) => Promise<void>;
  setUserPaymentsLoading: (loading: boolean) => void;
  setUserPaymentsError: (error: string | null) => void;
  clearUserPayments: () => void;

  // Actions for current payment
  setCurrentPayment: (payment: Payment | null) => void;
  setCurrentPaymentLoading: (loading: boolean) => void;
  setCurrentPaymentError: (error: string | null) => void;
  clearCurrentPayment: () => void;

  // CRUD actions
  createPayment: (params: CreatePaymentRequest) => Promise<Payment>;
  checkPaymentStatus: (transactionId: string, provider: string) => Promise<PaymentStatusResult>;
  getPaymentById: (paymentId: string) => Promise<void>;
  getPaymentByBooking: (bookingId: string) => Promise<Payment | null>;

  // Utility actions
  getCachedPaymentByBooking: (bookingId: string) => Payment | null;
}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      // Initial state
      userPayments: [],
      userPaymentsLoading: false,
      userPaymentsError: null,
      lastUserPaymentsFetch: null,

      currentPayment: null,
      currentPaymentLoading: false,
      currentPaymentError: null,

      isCreatingPayment: false,
      createPaymentError: null,

      isCheckingStatus: false,
      checkStatusError: null,

      // Actions for user payments
      fetchUserPayments: async (userId: string) => {
        const { lastUserPaymentsFetch, userPayments } = get();
        const now = Date.now();
        
        // Don't fetch if we already have recent data (5 minutes cache)
        if (lastUserPaymentsFetch && 
            now - lastUserPaymentsFetch < 5 * 60 * 1000 && 
            userPayments.length > 0) {
          return;
        }

        set({ userPaymentsLoading: true, userPaymentsError: null });

        try {
          const response = await paymentApiClient.getUserPayments(userId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch user payments");
          }
          
          set({
            userPayments: response.data || [],
            userPaymentsLoading: false,
            userPaymentsError: null,
            lastUserPaymentsFetch: now,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch user payments";
          set({
            userPaymentsLoading: false,
            userPaymentsError: errorMessage,
          });
        }
      },

      refreshUserPayments: async (userId: string) => {
        // Force refresh by clearing cache
        set({ lastUserPaymentsFetch: null });
        await get().fetchUserPayments(userId);
      },

      setUserPaymentsLoading: (loading) => {
        set({ userPaymentsLoading: loading });
      },

      setUserPaymentsError: (error) => {
        set({ userPaymentsError: error });
      },

      clearUserPayments: () => {
        set({
          userPayments: [],
          userPaymentsError: null,
          lastUserPaymentsFetch: null,
        });
      },

      // Actions for current payment
      setCurrentPayment: (payment) => {
        set({ currentPayment: payment });
      },

      setCurrentPaymentLoading: (loading) => {
        set({ currentPaymentLoading: loading });
      },

      setCurrentPaymentError: (error) => {
        set({ currentPaymentError: error });
      },

      clearCurrentPayment: () => {
        set({
          currentPayment: null,
          currentPaymentError: null,
        });
      },

      // CRUD actions
      createPayment: async (params: CreatePaymentRequest) => {
        set({ isCreatingPayment: true, createPaymentError: null });

        try {
          const response = await paymentApiClient.createPayment(params);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to create payment");
          }

          // Update current payment
          set({ 
            currentPayment: response.data!,
            isCreatingPayment: false, 
            createPaymentError: null 
          });
          
          return response.data!;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to create payment";
          set({ isCreatingPayment: false, createPaymentError: errorMessage });
          throw error;
        }
      },

      checkPaymentStatus: async (transactionId: string, provider: string) => {
        set({ isCheckingStatus: true, checkStatusError: null });

        try {
          const response = await paymentApiClient.checkPaymentStatus(transactionId, provider);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to check payment status");
          }

          // Update current payment status if it matches
          const { currentPayment } = get();
          if (currentPayment?.transaction_id === transactionId) {
            set({
              currentPayment: {
                ...currentPayment,
                status: response.data!.status
              }
            });
          }

          set({ isCheckingStatus: false, checkStatusError: null });
          return response.data!;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to check payment status";
          set({ isCheckingStatus: false, checkStatusError: errorMessage });
          throw error;
        }
      },

      getPaymentById: async (paymentId: string) => {
        set({ currentPaymentLoading: true, currentPaymentError: null });

        try {
          const response = await paymentApiClient.getPaymentById(paymentId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch payment");
          }
          
          set({
            currentPayment: response.data || null,
            currentPaymentLoading: false,
            currentPaymentError: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch payment";
          set({
            currentPaymentLoading: false,
            currentPaymentError: errorMessage,
          });
        }
      },

      getPaymentByBooking: async (bookingId: string) => {
        try {
          const response = await paymentApiClient.getPaymentByBooking(bookingId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch payment for booking");
          }

          return response.data || null;
        } catch (error) {
          throw error;
        }
      },

      // Utility actions
      getCachedPaymentByBooking: (bookingId: string) => {
        const { userPayments } = get();
        return userPayments.find(payment => payment.booking_id === bookingId) || null;
      },
    }),
    {
      name: getVersionedStorageKey('payment-storage'),
      // Only persist the data, not loading states
      partialize: (state) => ({
        userPayments: state.userPayments,
        lastUserPaymentsFetch: state.lastUserPaymentsFetch,
        currentPayment: state.currentPayment,
      }),
    }
  )
);
