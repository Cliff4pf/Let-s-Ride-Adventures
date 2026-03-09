namespace RideHub.Api.DTOs
{
    public class UpdatePaymentStatusDTO
    {
        public string PaymentStatus { get; set; } = "PAID"; // Only valid payload is PAID for checkout success
    }
}
