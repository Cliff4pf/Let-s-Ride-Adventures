using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class Message
    {
        [FirestoreDocumentId]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [FirestoreProperty]
        public string SenderId { get; set; } = string.Empty;

        [FirestoreProperty]
        public string RecipientId { get; set; } = string.Empty;

        [FirestoreProperty]
        public string? BookingId { get; set; } // Related booking if any

        [FirestoreProperty]
        public string Content { get; set; } = string.Empty;

        [FirestoreProperty]
        public bool IsRead { get; set; } = false;

        [FirestoreProperty]
        public string Type { get; set; } = "TEXT"; // TEXT | SYSTEM | LOCATION_UPDATE

        [FirestoreProperty]
        public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();

        [FirestoreProperty]
        public Timestamp? ReadAt { get; set; }
    }
}
