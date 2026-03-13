using System.ComponentModel.DataAnnotations;

namespace RideHub.Api.DTOs
{
    public class AssignBookingDTO
    {
        [Required]
        public string BookingId { get; set; } = string.Empty;

        // DriverId is optional - will be auto-populated from vehicle's AssignedDriverId if not provided
        public string? DriverId { get; set; }

        [Required]
        public string VehicleId { get; set; } = string.Empty;
    }
}
