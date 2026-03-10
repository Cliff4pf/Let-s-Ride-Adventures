using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class Feedback
    {
        [FirestoreDocumentId]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [FirestoreProperty]
        public string UserId { get; set; } = string.Empty;

        [FirestoreProperty]
        public string? BookingId { get; set; }

        [FirestoreProperty]
        public string? TargetUserId { get; set; } // Driver or service provider being reviewed

        [FirestoreProperty]
        public int Rating { get; set; } = 5; // 1-5 stars

        [FirestoreProperty]
        public string Comment { get; set; } = string.Empty;

        [FirestoreProperty]
        public string Type { get; set; } = "SERVICE"; // SERVICE | DRIVER | GENERAL

        [FirestoreProperty]
        public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();

        [FirestoreProperty]
        public Timestamp? UpdatedAt { get; set; }
    }
}
