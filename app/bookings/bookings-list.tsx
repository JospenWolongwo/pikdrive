import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { BookingCard } from "./booking-card"
import { ReceiptService } from "@/lib/payment/receipt-service"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

interface Driver {
  full_name: string;
  avatar_url: string;
}

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: Driver;
}

interface PaymentMetadata {
  financialTransactionId?: string;
  [key: string]: any;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  phone_number: string;
  transaction_id: string;
  payment_time: string | null;
  metadata: PaymentMetadata;
  status: string;
}

interface Booking {
  id: string;
  seats: number;
  status: string;
  payment_status: string;
  created_at: string;
  ride?: Ride;
  payments?: Payment[];
}

interface BookingReceipt {
  id: string;
  payment_id: string;
  created_at: string;
}

async function getBookingsWithReceipts(userId: string, page: number = 1, itemsPerPage: number = 10) {
  const supabase = createServerComponentClient({ cookies })
  
  // First get total count for pagination
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  const totalPages = Math.ceil((count || 0) / itemsPerPage);
  
  // Then get paginated bookings
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      status,
      payment_status,
      created_at,
      ride:rides (
        id,
        from_city,
        to_city,
        departure_time,
        car_model,
        car_color,
        price,
        driver:profiles (
          full_name,
          avatar_url
        )
      ),
      payments (
        id,
        amount,
        currency,
        phone_number,
        transaction_id,
        payment_time,
        metadata
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * itemsPerPage, page * itemsPerPage - 1) as { data: Booking[] | null; error: any };

  if (bookingsError) {
    throw bookingsError;
  }

  // First get all receipts
  const receipts = await Promise.all(
    (bookings || []).map(async (booking) => {
      const payment = booking.payments?.[0];
      const isCompleted = payment?.payment_time && payment?.metadata?.financialTransactionId;
      
      if (isCompleted && payment) {
        try {
          const { data: existingReceipt, error: receiptError } = await supabase
            .from('payment_receipts')
            .select('id, issued_at, created_at')
            .eq('payment_id', payment.id)
            .single();

          console.log('🧾 Receipt check:', {
            paymentId: payment.id,
            hasExisting: !!existingReceipt,
            error: receiptError?.message
          });

          if (!existingReceipt) {
            console.log('📝 Creating new receipt for payment:', payment.id);
            const { data: newReceipt, error: createError } = await supabase
              .rpc('create_receipt', { payment_id_param: payment.id })
              .select()
              .single();

            console.log('✨ Receipt creation result:', {
              paymentId: payment.id,
              success: !!newReceipt,
              error: createError?.message
            });

            if (newReceipt) {
              return {
                id: newReceipt.id,
                payment_id: payment.id,
                created_at: newReceipt.issued_at || newReceipt.created_at
              } as BookingReceipt;
            }
          } else {
            return {
              id: existingReceipt.id,
              payment_id: payment.id,
              created_at: existingReceipt.issued_at || existingReceipt.created_at
            } as BookingReceipt;
          }
        } catch (error) {
          console.error('❌ Error handling receipt:', error);
        }
      }
      return null;
    })
  );

  const validReceipts = receipts.filter(Boolean) as BookingReceipt[];
  console.log('📜 Valid receipts:', validReceipts);

  // Then map bookings with their receipts
  return { 
    bookings: bookings?.map(booking => {
      const payment = booking.payments?.[0];
      const isCompleted = payment?.payment_time && payment?.metadata?.financialTransactionId;
      const receipt = payment ? validReceipts.find(r => r.payment_id === payment.id) : null;
      
      console.log('🎟️ Mapping booking:', {
        bookingId: booking.id,
        paymentId: payment?.id,
        hasReceipt: !!receipt,
        receiptId: receipt?.id
      });

      return {
        ...booking,
        payments: payment ? {
          ...payment,
          amount: booking.ride?.price ? booking.ride.price * booking.seats : 0,
          status: isCompleted ? 'completed' : 'pending'
        } : null,
        receipt
      };
    }), 
    receipts: validReceipts,
    totalPages
  };
}

interface BookingsListProps {
  userId: string;
  page?: number;
}

export async function BookingsList({ userId, page = 1 }: BookingsListProps) {
  const { bookings, receipts, totalPages } = await getBookingsWithReceipts(userId, page);

  if (!bookings?.length) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-2">No Bookings Yet</h2>
        <p className="text-muted-foreground">
          You haven't made any bookings yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bookings List */}
      <div className="space-y-4">
        {bookings.map((booking) => {
          const receipt = booking.receipt;
          return (
            <BookingCard 
              key={booking.id} 
              booking={booking}
              receipt={receipt}
            />
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="justify-center">
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`/bookings?page=${page - 1}`} />
              </PaginationItem>
            )}
            
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i + 1}>
                <PaginationLink
                  href={`/bookings?page=${i + 1}`}
                  isActive={page === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={`/bookings?page=${page + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
