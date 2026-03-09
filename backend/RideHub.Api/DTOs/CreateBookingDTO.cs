using System;

namespace RideHub.Api.DTOs
{
    public class CreateBookingDto
    {
        public string PickupLocation { get; set; } = string.Empty;
        public string Destination { get; set; } = string.Empty;
        public DateTime ScheduledDate { get; set; }
        public int PassengerCount { get; set; }
        public string VehicleType { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;

        // Additional fields for secretary booking creation
        public DateTime? StartDate { get; set; }
        public int? NumberOfGuests { get; set; }
        public string? VehiclePreference { get; set; }
        public string? SpecialRequests { get; set; }
        public double? Price { get; set; }
        public string? BookingType { get; set; }
        public string? ServiceType { get; set; }
    }
}
