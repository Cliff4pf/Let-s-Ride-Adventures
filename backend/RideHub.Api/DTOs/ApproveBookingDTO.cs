using System.ComponentModel.DataAnnotations;

namespace RideHub.Api.DTOs
{
    public class ApproveBookingDTO
    {
        [Required]
        public string BookingId { get; set; } = string.Empty;
    }
}
