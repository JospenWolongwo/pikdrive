import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { 
  Booking, 
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking 
} from "@/types";
import { bookingApiClient } from "@/lib/api-client/booking";

interface BookingState {
  // User bookings state
  userBookings: BookingWithDetails[];
  userBookingsLoading: boolean;
  userBookingsError: string | null;
  lastUserBookingsFetch: number | null;

  // Driver bookings state
  driverBookings: DriverBooking[];
  driverBookingsLoading: boolean;
  driverBookingsError: string | null;
  lastDriverBookingsFetch: number | null;

  // Current booking state (for modal)
  currentBooking: BookingWithDetails | null;
  currentBookingLoading: boolean;
  currentBookingError: string | null;

  // Booking creation state
  isCreatingBooking: boolean;
  createBookingError: string | null;

  // Passenger info cache
  passengerInfoComplete: boolean | null;
  passengerInfoProfileName: string;
  lastPassengerInfoFetch: number | null;
  passengerInfoLoading: boolean;

  // Actions for user bookings
  fetchUserBookings: (userId: string) => Promise<void>;
  refreshUserBookings: (userId: string) => Promise<void>;
  setUserBookingsLoading: (loading: boolean) => void;
  setUserBookingsError: (error: string | null) => void;
  clearUserBookings: () => void;

  // Actions for driver bookings
  fetchDriverBookings: (driverId: string) => Promise<void>;
  refreshDriverBookings: (driverId: string) => Promise<void>;
  setDriverBookingsLoading: (loading: boolean) => void;
  setDriverBookingsError: (error: string | null) => void;
  clearDriverBookings: () => void;

  // Actions for current booking
  fetchBookingById: (bookingId: string) => Promise<void>;
  setCurrentBooking: (booking: BookingWithDetails | null) => void;
  setCurrentBookingLoading: (loading: boolean) => void;
  setCurrentBookingError: (error: string | null) => void;
  clearCurrentBooking: () => void;

  // CRUD actions
  createBooking: (params: CreateBookingRequest & { user_id: string }, options?: { refreshUserBookings?: boolean }) => Promise<Booking>;
  updateBooking: (bookingId: string, params: UpdateBookingRequest) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<void>;
  verifyBookingCode: (bookingId: string, verificationCode: string) => Promise<boolean>;

  // Utility actions
  getExistingBookingForRide: (rideId: string, userId: string) => Promise<Booking | null>;
  getCachedBookingForRide: (rideId: string, userId: string) => Booking | null;

  // Passenger info actions
  checkPassengerInfo: (userId: string, force?: boolean) => Promise<{ isComplete: boolean; profileName: string }>;
  getCachedPassengerInfo: () => { isComplete: boolean | null; profileName: string } | null;
  invalidatePassengerInfoCache: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      // Initial state
      userBookings: [],
      userBookingsLoading: false,
      userBookingsError: null,
      lastUserBookingsFetch: null,

      driverBookings: [],
      driverBookingsLoading: false,
      driverBookingsError: null,
      lastDriverBookingsFetch: null,

      currentBooking: null,
      currentBookingLoading: false,
      currentBookingError: null,

      isCreatingBooking: false,
      createBookingError: null,

      // Passenger info cache
      passengerInfoComplete: null,
      passengerInfoProfileName: "",
      lastPassengerInfoFetch: null,
      passengerInfoLoading: false,

      // Actions for user bookings
      fetchUserBookings: async (userId: string) => {
        const { lastUserBookingsFetch, userBookings } = get();
        const now = Date.now();
        
        
        // Don't fetch if we already have recent data AND bookings are loaded
        if (lastUserBookingsFetch && 
            now - lastUserBookingsFetch < 5 * 60 * 1000 && 
            userBookings.length > 0) {
          return;
        }

        set({ userBookingsLoading: true, userBookingsError: null });

        try {
          const response = await bookingApiClient.getUserBookings(userId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch user bookings");
          }
          
          set({
            userBookings: response.data || [],
            userBookingsLoading: false,
            userBookingsError: null,
            lastUserBookingsFetch: now,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch user bookings";
          set({
            userBookingsLoading: false,
            userBookingsError: errorMessage,
          });
        }
      },

      refreshUserBookings: async (userId: string) => {
        // Force refresh by clearing cache
        set({ lastUserBookingsFetch: null });
        await get().fetchUserBookings(userId);
      },

      setUserBookingsLoading: (loading) => {
        set({ userBookingsLoading: loading });
      },

      setUserBookingsError: (error) => {
        set({ userBookingsError: error });
      },

      clearUserBookings: () => {
        set({
          userBookings: [],
          userBookingsError: null,
          lastUserBookingsFetch: null,
        });
      },

      // Actions for driver bookings
      fetchDriverBookings: async (driverId: string) => {
        const { lastDriverBookingsFetch } = get();
        const now = Date.now();
        
        // Don't fetch if we already have recent data (5 minutes cache)
        if (lastDriverBookingsFetch && now - lastDriverBookingsFetch < 5 * 60 * 1000) {
          return;
        }

        set({ driverBookingsLoading: true, driverBookingsError: null });

        try {
          const response = await bookingApiClient.getDriverBookings(driverId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch driver bookings");
          }
          
          set({
            driverBookings: response.data || [],
            driverBookingsLoading: false,
            driverBookingsError: null,
            lastDriverBookingsFetch: now,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch driver bookings";
          set({
            driverBookingsLoading: false,
            driverBookingsError: errorMessage,
          });
        }
      },

      refreshDriverBookings: async (driverId: string) => {
        // Force refresh by clearing cache
        set({ lastDriverBookingsFetch: null });
        await get().fetchDriverBookings(driverId);
      },

      setDriverBookingsLoading: (loading) => {
        set({ driverBookingsLoading: loading });
      },

      setDriverBookingsError: (error) => {
        set({ driverBookingsError: error });
      },

      clearDriverBookings: () => {
        set({
          driverBookings: [],
          driverBookingsError: null,
          lastDriverBookingsFetch: null,
        });
      },

      // Actions for current booking
      fetchBookingById: async (bookingId: string) => {
        set({ currentBookingLoading: true, currentBookingError: null });

        try {
          const response = await bookingApiClient.getBookingById(bookingId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to fetch booking");
          }
          
          set({
            currentBooking: response.data || null,
            currentBookingLoading: false,
            currentBookingError: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch booking";
          set({
            currentBookingLoading: false,
            currentBookingError: errorMessage,
          });
        }
      },

      setCurrentBooking: (booking) => {
        set({ currentBooking: booking });
      },

      setCurrentBookingLoading: (loading) => {
        set({ currentBookingLoading: loading });
      },

      setCurrentBookingError: (error) => {
        set({ currentBookingError: error });
      },

      clearCurrentBooking: () => {
        set({
          currentBooking: null,
          currentBookingError: null,
        });
      },

      // CRUD actions
      createBooking: async (params, options = {}) => {
        set({ isCreatingBooking: true, createBookingError: null });

        try {
          const response = await bookingApiClient.createBooking(params);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to create booking");
          }

          // Only refresh user bookings if explicitly requested (for performance)
          if (options.refreshUserBookings && params.user_id) {
            await get().refreshUserBookings(params.user_id);
          }

          set({ isCreatingBooking: false, createBookingError: null });
          return response.data!;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to create booking";
          set({ isCreatingBooking: false, createBookingError: errorMessage });
          throw error;
        }
      },

      updateBooking: async (bookingId: string, params: UpdateBookingRequest) => {
        try {
          const response = await bookingApiClient.updateBooking(bookingId, params);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to update booking");
          }

          // Update booking in local state if it exists
          const { userBookings, driverBookings } = get();
          const updatedBooking = response.data!;

          // Update in user bookings
          const updatedUserBookings = userBookings.map(booking => 
            booking.id === bookingId ? { ...booking, ...updatedBooking } : booking
          );
          set({ userBookings: updatedUserBookings });

          // Update in driver bookings
          const updatedDriverBookings = driverBookings.map(booking => 
            booking.id === bookingId ? { ...booking, ...updatedBooking } : booking
          );
          set({ driverBookings: updatedDriverBookings });

          // Update current booking if it's the same
          const { currentBooking } = get();
          if (currentBooking?.id === bookingId) {
            set({ currentBooking: { ...currentBooking, ...updatedBooking } });
          }
          
          return updatedBooking;
        } catch (error) {
          throw error;
        }
      },

      cancelBooking: async (bookingId: string) => {
        try {
          const response = await bookingApiClient.cancelBooking(bookingId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to cancel booking");
          }

          // Remove booking from local state
          const { userBookings, driverBookings } = get();
          const filteredUserBookings = userBookings.filter(booking => booking.id !== bookingId);
          const filteredDriverBookings = driverBookings.filter(booking => booking.id !== bookingId);
          
          set({ 
            userBookings: filteredUserBookings,
            driverBookings: filteredDriverBookings
          });
          
          // Clear current booking if it's the same
          const { currentBooking } = get();
          if (currentBooking?.id === bookingId) {
            set({ currentBooking: null });
          }
        } catch (error) {
          throw error;
        }
      },

      verifyBookingCode: async (bookingId: string, verificationCode: string) => {
        try {
          const response = await bookingApiClient.verifyBookingCode(bookingId, verificationCode);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to verify booking code");
          }

          return response.data?.success || false;
        } catch (error) {
          throw error;
        }
      },

      // Utility actions
      getExistingBookingForRide: async (rideId: string, userId: string) => {
        try {
          const response = await bookingApiClient.getExistingBookingForRide(rideId, userId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to check existing booking");
          }

          return response.data || null;
        } catch (error) {
          throw error;
        }
      },

      getCachedBookingForRide: (rideId: string, userId: string) => {
        const { userBookings } = get();
        return userBookings.find(
          booking => booking.ride_id === rideId && booking.user_id === userId
        ) || null;
      },

      // Passenger info actions
      checkPassengerInfo: async (userId: string, force = false) => {
        const { lastPassengerInfoFetch, passengerInfoComplete, passengerInfoProfileName } = get();
        const now = Date.now();
        
        // Use cache if fresh (5 minutes) and not forcing refresh
        if (!force && 
            lastPassengerInfoFetch && 
            now - lastPassengerInfoFetch < 5 * 60 * 1000 && 
            passengerInfoComplete !== null) {
          return {
            isComplete: passengerInfoComplete,
            profileName: passengerInfoProfileName,
          };
        }

        set({ passengerInfoLoading: true });

        try {
          const response = await bookingApiClient.checkPassengerInfo(userId);
          
          if (!response.success) {
            throw new Error(response.error || "Failed to check passenger info");
          }

          const { isComplete, profileName } = response.data!;

          set({
            passengerInfoComplete: isComplete,
            passengerInfoProfileName: profileName,
            lastPassengerInfoFetch: now,
            passengerInfoLoading: false,
          });

          return {
            isComplete,
            profileName,
          };
        } catch (error) {
          console.error("Error checking passenger info:", error);
          set({ 
            passengerInfoLoading: false,
            passengerInfoComplete: false,
            passengerInfoProfileName: "",
          });
          return {
            isComplete: false,
            profileName: "",
          };
        }
      },

      getCachedPassengerInfo: () => {
        const { lastPassengerInfoFetch, passengerInfoComplete, passengerInfoProfileName } = get();
        const now = Date.now();
        
        // Return cached value if fresh (5 minutes)
        if (lastPassengerInfoFetch && 
            now - lastPassengerInfoFetch < 5 * 60 * 1000 &&
            passengerInfoComplete !== null) {
          return {
            isComplete: passengerInfoComplete,
            profileName: passengerInfoProfileName,
          };
        }
        
        return null; // Cache expired or not set
      },

      invalidatePassengerInfoCache: () => {
        set({
          lastPassengerInfoFetch: null,
          passengerInfoComplete: null,
          passengerInfoProfileName: "",
        });
      },
    }),
    {
      name: 'booking-storage',
      // Only persist the data, not loading states
      partialize: (state) => ({
        userBookings: state.userBookings,
        lastUserBookingsFetch: state.lastUserBookingsFetch,
        driverBookings: state.driverBookings,
        lastDriverBookingsFetch: state.lastDriverBookingsFetch,
        passengerInfoComplete: state.passengerInfoComplete,
        passengerInfoProfileName: state.passengerInfoProfileName,
        lastPassengerInfoFetch: state.lastPassengerInfoFetch,
      }),
    }
  )
);
