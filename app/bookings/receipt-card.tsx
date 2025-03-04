'use client';

import { Receipt } from "@/lib/payment/receipt-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

interface ReceiptCardProps {
  receipt: Receipt;
}

export function ReceiptCard({ receipt }: ReceiptCardProps) {
  const downloadReceipt = async () => {
    // TODO: Implement actual PDF download
    window.open(receipt.pdf_url, '_blank');
  };

  return (
    <Card className="p-6 space-y-4 bg-muted/30">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">Receipt #{receipt.receipt_number}</h3>
          <p className="text-sm text-muted-foreground">
            Issued: {new Date(receipt.issued_at).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadReceipt}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Payment Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium">
                {formatCurrency(receipt.payment.amount, receipt.payment.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{receipt.payment.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Phone</span>
              <span className="font-mono text-sm">{receipt.payment.phone_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Transaction ID</span>
              <span className="font-mono text-sm">{receipt.payment.transaction_id}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Journey Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Route</span>
              <span className="font-medium">
                {receipt.payment.booking.ride.from_city} → {receipt.payment.booking.ride.to_city}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Departure</span>
              <span className="font-medium">
                {new Date(receipt.payment.booking.ride.departure_time).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Seats</span>
              <span className="font-medium">{receipt.payment.booking.seats}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-xs text-center text-muted-foreground">
          This is an electronic receipt for your payment. 
          Please keep it for your records.
        </p>
      </div>
    </Card>
  );
}
