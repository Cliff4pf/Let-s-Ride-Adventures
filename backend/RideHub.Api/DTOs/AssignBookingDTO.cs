using System.ComponentModel.DataAnnotations;

namespace RideHub.Api.DTOs
{
    public class AssignBookingDTO
    {
        [Required]
        public string BookingId { get; set; } = string.Empty;

        [Required]
        public string DriverId { get; set; } = string.Empty;

        [Required]
        public string VehicleId { get; set; } = string.Empty;
    }
}
