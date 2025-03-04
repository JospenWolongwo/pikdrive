# Payment Testing Guide

## MTN MOMO Sandbox Test Numbers

When testing payments in the sandbox environment, use these test phone numbers to simulate different payment scenarios:

| Phone Number   | Scenario | Description |
|---------------|----------|-------------|
| 237677777777  | Success  | Payment will be approved and completed successfully |
| 237666666666  | Rejected | User rejected the payment request |
| 237655555555  | Error    | Internal processing error occurred |
| 237644444444  | No Funds | Insufficient funds in user's account |
| 237633333333  | Timeout  | Payment request timed out |

## Testing Steps

1. Start a new booking:
   - Select number of seats
   - Click "Continue to Payment"

2. Choose payment method:
   - Select "MTN Mobile Money"
   - Enter one of the test numbers above

3. Expected Behavior:
   - For successful payments (237677777777):
     * Payment will be marked as successful
     * Seats will be deducted
     * Booking will be confirmed
   
   - For failed payments (other test numbers):
     * Payment will fail with specific error message
     * No seats will be deducted
     * Booking will remain pending
     * User can try payment again

## Notes

- In sandbox mode, no actual SMS notifications are sent
- Test numbers must be exact matches including the country code (237)
- Any non-test number in sandbox will default to successful payment
- Payment status updates happen automatically through polling

## Troubleshooting

If you encounter issues:

1. Check the browser console for detailed logs
2. Verify the test number is entered correctly with country code
3. Ensure you're in sandbox mode (check .env.local settings)
4. Check network tab for API responses

For any other issues, check the server logs or contact the development team.
