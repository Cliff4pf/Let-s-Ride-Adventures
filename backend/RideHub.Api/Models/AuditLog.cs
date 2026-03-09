using System;
using Google.Cloud.Firestore;

namespace RideHub.Api.Models
{
    [FirestoreData]
    public class AuditLog
    {
        [FirestoreDocumentId]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [FirestoreProperty]
        public string ActionType { get; set; } = string.Empty; 
        
        [FirestoreProperty]
        public string EntityId { get; set; } = string.Empty;
        
        [FirestoreProperty]
        public string EntityType { get; set; } = string.Empty; 
        
        [FirestoreProperty]
        public string PerformedByUid { get; set; } = string.Empty;
        
        [FirestoreProperty]
        public string Details { get; set; } = string.Empty;
        
        [FirestoreProperty]
        public Timestamp Timestamp { get; set; } = Timestamp.GetCurrentTimestamp();
    }
}
