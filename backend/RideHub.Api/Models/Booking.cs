using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class Booking
    {
        [FirestoreDocumentId]
        public string? Id { get; set; }

        [FirestoreProperty]
        public string UserId { get; set; } = string.Empty;   // tourist
        
        [FirestoreProperty]
        public string? AssignedDriverId { get; set; }
        
        [FirestoreProperty]
        public string? VehicleId { get; set; }

        [FirestoreProperty]
        public string BookingType { get; set; } = "Transfer"; // Tour | Transfer | Pickup
        
        [FirestoreProperty]
        public string ServiceType { get; set; } = "Transport";

        [FirestoreProperty]
        public string PickupLocation { get; set; } = string.Empty;
        
        [FirestoreProperty]
        public string Destination { get; set; } = string.Empty;

        [FirestoreProperty]
        public DateTime StartDate { get; set; }
        
        [FirestoreProperty]
        public DateTime? EndDate { get; set; }

        [FirestoreProperty]
        public int NumberOfGuests { get; set; }
        
        [FirestoreProperty]
        public string VehiclePreference { get; set; } = "Any";
        
        [FirestoreProperty]
        public string SpecialRequests { get; set; } = string.Empty;

        [FirestoreProperty]
        public double Price { get; set; }

        [FirestoreProperty]
        public string Status { get; set; } = "PENDING";
        
        [FirestoreProperty]
        public string PaymentStatus { get; set; } = "UNPAID";

        [FirestoreProperty]
        public bool CommissionCalculated { get; set; }

        [FirestoreProperty]
        public Timestamp CreatedAt { get; set; }
        
        [FirestoreProperty]
        public Timestamp? UpdatedAt { get; set; }

        [FirestoreProperty]
        public string? ApprovedBySecretaryId { get; set; }
        
        [FirestoreProperty]
        public string? ApprovedByAdminId { get; set; }
    }
}
