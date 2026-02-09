export interface Receipt {
  id: string;
  receipt_number: string;
  issued_at: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
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
