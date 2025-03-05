import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ReceiptService } from "@/lib/payment/receipt-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ReceiptPageProps {
  params: {
    id: string;
  };
}

interface Receipt {
  id: string;
  receipt_number: string;
  issued_at: string;
  pdf_url: string | null;
  payment: {
    amount: number;
    currency: string;
    phone_number: string;
    transaction_id: string;
    status: string;
    booking: {
      seats: number;
      ride: {
        from_city: string;
        to_city: string;
        departure_time: string;
      };
    };
  };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const supabase = createServerComponentClient({ cookies });
  
  // Get receipt details
  const { data: receipt } = await supabase
    .from('payment_receipts')
    .select(`
      id,
      receipt_number,
      issued_at,
      pdf_url,
      payment:payments (
        amount,
        currency,
        phone_number,
        transaction_id,
        status,
        booking:bookings (
          seats,
          ride:rides (
            from_city,
            to_city,
            departure_time
          )
        )
      )
    `)
    .eq('id', params.id)
    .single() as { data: Receipt | null };

  if (!receipt) {
    console.error('❌ Receipt not found:', params.id);
    notFound();
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Receipt</h1>
            <p className="text-muted-foreground">
              {ReceiptService.formatReceiptNumber(receipt.receipt_number)}
            </p>
          </div>
          <Button variant="outline" className="gap-2" asChild>
            <a href={receipt.pdf_url || `/api/receipts/${receipt.id}/pdf`} target="_blank">
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>

        {/* Receipt Details */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date Issued</p>
              <p className="font-medium">
                {ReceiptService.formatDateTime(receipt.issued_at)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Status</p>
              <p className="font-medium capitalize">{receipt.payment.status}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="font-semibold mb-2">Payment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium">
                  {receipt.payment.amount} {receipt.payment.currency}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium">{receipt.payment.phone_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-medium">{receipt.payment.transaction_id}</p>
              </div>
            </div>
          </div>

          {/* Ride Details */}
          <div>
            <h3 className="font-semibold mb-2">Ride Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">From</p>
                <p className="font-medium">{receipt.payment.booking.ride.from_city}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">To</p>
                <p className="font-medium">{receipt.payment.booking.ride.to_city}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Departure</p>
                <p className="font-medium">
                  {ReceiptService.formatDateTime(receipt.payment.booking.ride.departure_time)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seats</p>
                <p className="font-medium">{receipt.payment.booking.seats}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-sm text-muted-foreground pt-4 border-t">
          <p>This is an electronic receipt for your PikDrive ride. Thank you for riding with us!</p>
        </div>
      </Card>
    </div>
  );
}
