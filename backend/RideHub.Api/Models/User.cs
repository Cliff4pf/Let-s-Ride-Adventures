using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class User
    {
        [FirestoreDocumentId]
        public string Uid { get; set; } = string.Empty;

        [FirestoreProperty]
        public string FullName { get; set; } = string.Empty;

        [FirestoreProperty]
        public string Email { get; set; } = string.Empty;

        [FirestoreProperty]
        public string PhoneNumber { get; set; } = string.Empty;

        [FirestoreProperty]
        public string Role { get; set; } = "Tourist"; // Tourist | Driver | Secretary | Admin

        [FirestoreProperty]
        public string Status { get; set; } = "Active"; // Active | Inactive

        [FirestoreProperty]
        public double CommissionBalance { get; set; } = 0;

        [FirestoreProperty]
        public bool EmailVerified { get; set; } = false;

        // Driver-specific fields (optional)
        [FirestoreProperty]
        public string? LicenseNumber { get; set; }

        [FirestoreProperty]
        public string? AssignedVehicleId { get; set; }

        // Metadata
        [FirestoreProperty]
        public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
        
        [FirestoreProperty]
        public Timestamp? UpdatedAt { get; set; }

        [FirestoreProperty]
        public Timestamp? LastLogin { get; set; }
    }
}
