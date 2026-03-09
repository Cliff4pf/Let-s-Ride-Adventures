using System;

namespace RideHub.Api.DTOs
{
    public class UpdateBookingDto
    {
        public string? PickupLocation { get; set; }
        public string? Destination { get; set; }
        public DateTime? StartDate { get; set; }
        public int? NumberOfGuests { get; set; }
        public double? Price { get; set; }
        public string? SpecialRequests { get; set; }
        public string? BookingType { get; set; }
    }
}