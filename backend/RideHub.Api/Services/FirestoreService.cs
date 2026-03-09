using Google.Cloud.Firestore;
using RideHub.Api.Models;

namespace RideHub.Api.Services
{
    public class FirestoreService
    {
        private readonly FirestoreDb _firestoreDb;
        private const string CollectionName = "bookings";

        public FirestoreService(FirestoreDb firestoreDb)
        {
            _firestoreDb = firestoreDb;
        }

        // Add Booking
        public async Task<string> AddBookingAsync(Booking booking)
        {
            CollectionReference collection = _firestoreDb.Collection(CollectionName);
            DocumentReference document = await collection.AddAsync(booking);
            return document.Id;
        }

        // Get Booking
        public async Task<Booking?> GetBookingAsync(string id)
        {
            DocumentReference document = _firestoreDb.Collection(CollectionName).Document(id);
            DocumentSnapshot snapshot = await document.GetSnapshotAsync();

            if (snapshot.Exists)
            {
                Booking booking = snapshot.ConvertTo<Booking>();
                booking.Id = snapshot.Id;
                return booking;
            }

            return null;
        }

        // Get All Bookings
        public async Task<List<Booking>> GetAllBookingsAsync()
        {
            Query query = _firestoreDb.Collection(CollectionName);
            QuerySnapshot snapshot = await query.GetSnapshotAsync();
            List<Booking> bookings = new List<Booking>();

            foreach (DocumentSnapshot document in snapshot.Documents)
            {
                Booking booking = document.ConvertTo<Booking>();
                booking.Id = document.Id;
                bookings.Add(booking);
            }

            return bookings;
        }

        // Update Booking
        public async Task UpdateBookingAsync(Booking booking)
        {
            if (string.IsNullOrEmpty(booking.Id)) throw new ArgumentException("Booking ID cannot be null or empty");

            DocumentReference document = _firestoreDb.Collection(CollectionName).Document(booking.Id);
            await document.SetAsync(booking, SetOptions.Overwrite);
        }

        // Delete Booking
        public async Task DeleteBookingAsync(string id)
        {
            DocumentReference document = _firestoreDb.Collection(CollectionName).Document(id);
            await document.DeleteAsync();
        }

        // Generic methods or methods for Users/Vehicles can be added here or in separate services/methods
        // For now, focusing on Booking as per Phase 2 instructions which listed Add/Get/Update/Delete Booking specifically.
        
        // Transactional Assignment
        public async Task AssignBookingTransactionAsync(string bookingId, string vehicleId, string driverId)
        {
            await _firestoreDb.RunTransactionAsync(async transaction =>
            {
                var bookingRef = _firestoreDb.Collection("bookings").Document(bookingId);
                var vehicleRef = _firestoreDb.Collection("vehicles").Document(vehicleId);
                var driverRef = _firestoreDb.Collection("users").Document(driverId);

                var bookingSnap = await transaction.GetSnapshotAsync(bookingRef);
                var vehicleSnap = await transaction.GetSnapshotAsync(vehicleRef);
                var driverSnap = await transaction.GetSnapshotAsync(driverRef);

                if (!bookingSnap.Exists) throw new Exception("Booking not found");
                if (!vehicleSnap.Exists) throw new Exception("Vehicle not found");
                if (!driverSnap.Exists) throw new Exception("Driver not found");

                var vehicle = vehicleSnap.ConvertTo<Vehicle>();
                if (!vehicle.IsAvailable) throw new Exception("Vehicle is no longer available");

                var booking = bookingSnap.ConvertTo<Booking>();
                if (booking.Status != "APPROVED") throw new Exception("Booking is not in APPROVED state");

                var driver = driverSnap.ConvertTo<User>();
                if (driver.Role != "Driver" || driver.Status != "Active") throw new Exception("Driver is not valid or active");

                transaction.Update(vehicleRef, "IsAvailable", false);
                transaction.Update(driverRef, "AssignedVehicleId", vehicleId);
                
                Dictionary<string, object> bookingUpdates = new Dictionary<string, object>
                {
                    { "AssignedDriverId", driverId },
                    { "AssignedVehicleId", vehicleId },
                    { "Status", "ASSIGNED" }
                };
                transaction.Update(bookingRef, bookingUpdates);
            });
        }
        
        // However, standard clean architecture would prefer generic or separate repositories, but "FirestoreService" implies a central service.
        // I will add methods for Users and Vehicles as well since they are in the plan.
        
        // Unified User Methods
        public async Task CreateUserAsync(User user)
        {
            if (string.IsNullOrEmpty(user.Uid)) throw new ArgumentException("UID cannot be null or empty");
            DocumentReference document = _firestoreDb.Collection("users").Document(user.Uid);
            await document.SetAsync(user);
        }

        public async Task<User?> GetUserAsync(string uid)
        {
            DocumentSnapshot snapshot = await _firestoreDb.Collection("users").Document(uid).GetSnapshotAsync();
            if (snapshot.Exists)
            {
                return snapshot.ConvertTo<User>();
            }
            return null;
        }

        public async Task UpdateUserAsync(User user)
        {
            if (string.IsNullOrEmpty(user.Uid)) throw new ArgumentException("UID cannot be null or empty");
            DocumentReference document = _firestoreDb.Collection("users").Document(user.Uid);
            await document.SetAsync(user, SetOptions.MergeAll);
        }

        public async Task<List<User>> GetUsersByRoleAsync(string role)
        {
            Query query = _firestoreDb.Collection("users").WhereEqualTo("Role", role);
            QuerySnapshot snapshot = await query.GetSnapshotAsync();
            return snapshot.Documents.Select(d => d.ConvertTo<User>()).ToList();
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            QuerySnapshot snapshot = await _firestoreDb.Collection("users").GetSnapshotAsync();
            return snapshot.Documents.Select(d => d.ConvertTo<User>()).ToList();
        }

        // Vehicle Methods
        public async Task<string> AddVehicleAsync(Vehicle vehicle)
        {
            CollectionReference collection = _firestoreDb.Collection("vehicles");
            DocumentReference document = await collection.AddAsync(vehicle);
            return document.Id;
        }

        public async Task<Vehicle?> GetVehicleAsync(string id)
        {
            DocumentSnapshot snapshot = await _firestoreDb.Collection("vehicles").Document(id).GetSnapshotAsync();
            if (snapshot.Exists)
            {
                Vehicle vehicle = snapshot.ConvertTo<Vehicle>();
                vehicle.Id = snapshot.Id;
                return vehicle;
            }
            return null;
        }
        
        public async Task<List<Vehicle>> GetAllVehiclesAsync()
        {
             QuerySnapshot snapshot = await _firestoreDb.Collection("vehicles").GetSnapshotAsync();
            return snapshot.Documents.Select(d => 
            {
                var v = d.ConvertTo<Vehicle>();
                v.Id = d.Id;
                return v;
            }).ToList();
        }
        
        public async Task UpdateVehicleAsync(Vehicle vehicle)
        {
             if (string.IsNullOrEmpty(vehicle.Id)) throw new ArgumentException("Vehicle ID cannot be null or empty");
             await _firestoreDb.Collection("vehicles").Document(vehicle.Id).SetAsync(vehicle, SetOptions.Overwrite);
        }

        public async Task DeleteVehicleAsync(string id)
        {
            await _firestoreDb.Collection("vehicles").Document(id).DeleteAsync();
        }

        // Notifications
        public async Task CreateNotificationAsync(Notification notif)
        {
            await _firestoreDb.Collection("notifications").AddAsync(notif);
        }

        // Audit Logs
        public async Task CreateAuditLogAsync(AuditLog log)
        {
            await _firestoreDb.Collection("auditLogs").AddAsync(log);
        }

        // Commission & Revenue
        public async Task AddCommissionAndRevenueAsync(string driverId, decimal bookingPrice)
        {
            await _firestoreDb.RunTransactionAsync(async transaction => 
            {
                // 1. Update Driver Commission (80%)
                var driverRef = _firestoreDb.Collection("users").Document(driverId);
                var driverSnap = await transaction.GetSnapshotAsync(driverRef);
                if (driverSnap.Exists)
                {
                    var driver = driverSnap.ConvertTo<User>();
                    double currentBalance = (double)driver.CommissionBalance;
                    double addedCommission = (double)(bookingPrice * 0.80m);
                    transaction.Update(driverRef, "CommissionBalance", currentBalance + addedCommission);
                }

                // 2. Update Platform Metrics (20% Revenue)
                var metricsRef = _firestoreDb.Collection("metrics").Document("revenueSummary");
                var metricsSnap = await transaction.GetSnapshotAsync(metricsRef);
                double platformRevenue = (double)(bookingPrice * 0.20m);
                double totalVolume = (double)bookingPrice;
                
                if (metricsSnap.Exists)
                {
                    var data = metricsSnap.ToDictionary();
                    double currentRev = data.ContainsKey("TotalRevenue") ? Convert.ToDouble(data["TotalRevenue"]) : 0;
                    double currentVol = data.ContainsKey("TotalVolume") ? Convert.ToDouble(data["TotalVolume"]) : 0;
                    
                    transaction.Update(metricsRef, "TotalRevenue", currentRev + platformRevenue);
                    transaction.Update(metricsRef, "TotalVolume", currentVol + totalVolume);
                    transaction.Update(metricsRef, "LastUpdated", Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp());
                }
                else
                {
                    var newMetrics = new
                    {
                        TotalRevenue = platformRevenue,
                        TotalVolume = totalVolume,
                        LastUpdated = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp()
                    };
                    transaction.Set(metricsRef, newMetrics);
                }
            });
        }

        // Migration: Add missing fields to all documents in a collection
        public async Task MigrateCollectionAsync(string collectionName, Dictionary<string, object> defaultFields)
        {
            var collection = _firestoreDb.Collection(collectionName);
            var snapshot = await collection.GetSnapshotAsync();
            
            foreach (var document in snapshot.Documents)
            {
                var data = document.ToDictionary();
                bool needsUpdate = false;
                
                foreach (var field in defaultFields)
                {
                    if (!data.ContainsKey(field.Key))
                    {
                        data[field.Key] = field.Value;
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate)
                {
                    await document.Reference.UpdateAsync(data);
                }
            }
        }

        // Migration: Ensure metrics document exists
        public async Task MigrateMetricsAsync()
        {
            var metricsRef = _firestoreDb.Collection("metrics").Document("revenueSummary");
            var metricsSnap = await metricsRef.GetSnapshotAsync();
            if (!metricsSnap.Exists)
            {
                var newMetrics = new
                {
                    TotalRevenue = 0.0,
                    TotalVolume = 0.0,
                    LastUpdated = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp()
                };
                await metricsRef.SetAsync(newMetrics);
            }
        }
    }
}
