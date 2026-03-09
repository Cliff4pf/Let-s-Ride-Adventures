using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class Vehicle
    {
        [FirestoreDocumentId]
        public string? Id { get; set; }

        // Identification
        [FirestoreProperty]
        public string RegistrationNumber { get; set; } = string.Empty;

        [FirestoreProperty]
        public string Make { get; set; } = string.Empty;

        [FirestoreProperty]
        public string Model { get; set; } = string.Empty;

        [FirestoreProperty]
        public int Year { get; set; }

        [FirestoreProperty]
        public string VehicleType { get; set; } = string.Empty;
        // Van, SUV, Bus, Sedan, etc.

        // Capacity & pricing
        [FirestoreProperty]
        public int SeatingCapacity { get; set; }

        [FirestoreProperty]
        public double PricePerDay { get; set; }

        // Status
        [FirestoreProperty]
        public bool IsAvailable { get; set; } = true;

        [FirestoreProperty]
        public string Status { get; set; } = "active";
        // active | maintenance | retired

        // Assignment
        [FirestoreProperty]
        public string? AssignedDriverId { get; set; }

        // Metadata
        [FirestoreProperty]
        public Timestamp CreatedAt { get; set; }
            = Timestamp.GetCurrentTimestamp();

        [FirestoreProperty]
        public Timestamp? UpdatedAt { get; set; }
    }
}
