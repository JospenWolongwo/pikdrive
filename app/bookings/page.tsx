import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { BookingsList } from "./bookings-list";

interface BookingsPageProps {
  searchParams: {
    page?: string;
  };
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const page = searchParams.page ? parseInt(searchParams.page) : 1;

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('🔐 Authentication error:', userError);
      throw userError;
    }
    
    if (!user) {
      return (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Please Sign In</h2>
          <p className="text-muted-foreground">
            You need to be signed in to view your bookings.
          </p>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">My Bookings</h1>
        <BookingsList userId={user.id} page={page} />
      </div>
    );
  } catch (error) {
    console.error('❌ Error in BookingsPage:', error);
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2 text-red-600">Error</h2>
          <p className="text-muted-foreground">
            There was an error loading your bookings. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
