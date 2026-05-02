using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.DTOs;
using RideHub.Api.Services;
using RideHub.Api.Attributes;
using System.Linq;

namespace RideHub.Api.Controllers
{
    public class UpdateBookingStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class BookingController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;
        private readonly EmailService _emailService;

        public BookingController(FirestoreService firestoreService, EmailService emailService)
        {
            _firestoreService = firestoreService;
            _emailService = emailService;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        }

        private async Task<User?> GetCurrentUserProfileAsync()
        {
            var uid = GetCurrentUserId();
            if (string.IsNullOrEmpty(uid)) return null;
            return await _firestoreService.GetUserAsync(uid);
        }

        // POST: api/booking (Tourist)
        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));

            var booking = new Booking
            {
                UserId = profile.Uid,
                BookingType = dto.BookingType ?? dto.VehicleType ?? "Transfer",
                ServiceType = dto.ServiceType ?? "Transport",
                StartDate = dto.StartDate ?? dto.ScheduledDate,
                PickupLocation = dto.PickupLocation,
                Destination = dto.Destination,
                Price = dto.Price ?? 0,
                PaymentStatus = "UNPAID",
                NumberOfGuests = dto.NumberOfGuests ?? dto.PassengerCount,
                VehiclePreference = dto.VehiclePreference ?? dto.VehicleType ?? "Any",
                SpecialRequests = dto.SpecialRequests ?? dto.Notes,
                Status = "PENDING",
                CreatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp()
            };
            string id = await _firestoreService.AddBookingAsync(booking);
            
            await _emailService.SendEmail(
                profile.Email,
                "RideHub Booking Confirmed",
                $"Your booking to {booking.Destination} has been created. Amount: KSH {booking.Price}"
            );

            return Ok(ApiResponse<object>.Ok(new { id }, "Booking created successfully."));
        }

        // GET: api/booking
        [HttpGet]
        public async Task<IActionResult> GetAllBookings()
        {
            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized();

            var allBookings = await _firestoreService.GetAllBookingsAsync();

            if (profile.Role == "Admin" || profile.Role == "Secretary")
            {
                return Ok(allBookings);
            }
            else if (profile.Role == "Driver")
            {
                return Ok(allBookings.Where(b => b.AssignedDriverId == profile.Uid).ToList());
            }
            else
            {
                return Ok(allBookings.Where(b => b.UserId == profile.Uid).ToList());
            }
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBooking(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound();

             var profile = await GetCurrentUserProfileAsync();
             if (profile == null) return Unauthorized();
             
             if (profile.Role == "Admin" || profile.Role == "Secretary") return Ok(booking);
             if (profile.Role == "Driver" && booking.AssignedDriverId == profile.Uid) return Ok(booking);
             if (booking.UserId == profile.Uid) return Ok(booking);

             return Forbid();
        }

        // PUT: api/booking/{id}/approve (Secretary/Admin)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPatch("{id}/approve")]
        public async Task<IActionResult> ApproveBooking(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile?.Role == "Admin") booking.ApprovedByAdminId = profile.Uid;
            if (profile?.Role == "Secretary") booking.ApprovedBySecretaryId = profile.Uid;

            booking.Status = "APPROVED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Booking Approved",
                    $"Your booking to {booking.Destination} has been approved."
                );
            }

            return Ok(new { message = "Booking approved" });
        }

        // PUT: api/booking/{id}/assign/{driverId} (Secretary/Admin)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPatch("{id}/assign/{driverId}")]
        public async Task<IActionResult> AssignBooking(string id, string driverId)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));
            
            booking.AssignedDriverId = driverId;
            booking.Status = "ASSIGNED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            var driver = await _firestoreService.GetUserAsync(driverId);

            if (tourist != null && driver != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Driver Assigned",
                    $"A driver ({driver.FullName}) has been assigned to your trip to {booking.Destination}."
                );
                
                await _emailService.SendEmail(
                    driver.Email,
                    "RideHub New Assignment",
                    $"You have been assigned to trip {booking.Id} to {booking.Destination}."
                );
            }

            return Ok(new { message = "Driver assigned" });
        }

        // PUT: api/booking/assign (Secretary/Admin - Assign both driver and vehicle)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("assign")]
        public async Task<IActionResult> AssignBookingWithVehicle([FromBody] AssignBookingDTO dto)
        {
            Console.WriteLine($"AssignBookingWithVehicle called with BookingId: {dto.BookingId}, DriverId: {dto.DriverId}, VehicleId: {dto.VehicleId}");
            
            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));

            var booking = await _firestoreService.GetBookingAsync(dto.BookingId);
            if (booking == null) {
                Console.WriteLine($"Booking not found: {dto.BookingId}");
                return NotFound(ApiResponse.Error("Booking not found."));
            }
            Console.WriteLine($"Found booking: {booking.Id}, Status: {booking.Status}");

            var vehicle = await _firestoreService.GetVehicleAsync(dto.VehicleId);
            if (vehicle == null) {
                Console.WriteLine($"Vehicle not found: {dto.VehicleId}");
                return NotFound(ApiResponse.Error("Vehicle not found."));
            }
            Console.WriteLine($"Found vehicle: {vehicle.Id}, IsAvailable: {vehicle.IsAvailable}");

            // Check if vehicle is available
            if (!vehicle.IsAvailable)
            {
                Console.WriteLine($"Vehicle not available: {vehicle.Id}");
                return BadRequest(ApiResponse.Error("Vehicle is not available."));
            }

            // Determine driver ID: use provided DriverId or auto-assign from vehicle's AssignedDriverId
            string? driverId = !string.IsNullOrEmpty(dto.DriverId) ? dto.DriverId : vehicle.AssignedDriverId;
            
            if (string.IsNullOrEmpty(driverId))
            {
                return BadRequest(ApiResponse.Error("No driver specified and vehicle has no assigned driver."));
            }

            var driver = await _firestoreService.GetUserAsync(driverId);
            if (driver == null) return NotFound(ApiResponse.Error("Driver not found."));

            // Check if driver is active
            if (driver.Status != "Active")
            {
                return BadRequest(ApiResponse.Error("Driver is not active."));
            }

            booking.AssignedDriverId = driverId;
            booking.VehicleId = dto.VehicleId;
            booking.Status = "ASSIGNED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            // Mark vehicle as unavailable
            vehicle.IsAvailable = false;
            vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            await _firestoreService.UpdateBookingAsync(booking);
            await _firestoreService.UpdateVehicleAsync(vehicle);

            Console.WriteLine($"Assignment completed. Booking status: {booking.Status}, Vehicle status: {vehicle.Status}");

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);

            // Update vehicle status to Reserved when booking is assigned
            vehicle.Status = "reserved";
            await _firestoreService.UpdateVehicleAsync(vehicle);

            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Assignment Complete",
                    $"Your trip to {booking.Destination} has been assigned.\n\n" +
                    $"Vehicle: {vehicle.Make} {vehicle.Model} ({vehicle.VehicleType})\n" +
                    $"Registration: {vehicle.RegistrationNumber}\n" +
                    $"Seating: {vehicle.SeatingCapacity} passengers\n\n" +
                    $"Driver: {driver.FullName}\n" +
                    $"Contact: {driver.PhoneNumber}\n\n" +
                    $"Pickup: {booking.PickupLocation}\n" +
                    $"Destination: {booking.Destination}\n" +
                    $"Date: {booking.StartDate:MMMM dd, yyyy @ HH:mm}\n" +
                    $"Amount: KSH {booking.Price:N2}"
                );

                // Create in-app notification for tourist
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Trip Assigned",
                    Message = $"Your trip to {booking.Destination} has been assigned with driver {driver.FullName} and vehicle {vehicle.RegistrationNumber}.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            if (driver != null)
            {
                await _emailService.SendEmail(
                    driver.Email,
                    "RideHub New Assignment",
                    $"You have been assigned to trip {booking.Id}.\n\n" +
                    $"Tourist: {tourist?.FullName ?? "Unknown"}\n" +
                    $"Contact: {tourist?.PhoneNumber ?? "N/A"}\n\n" +
                    $"Pickup: {booking.PickupLocation}\n" +
                    $"Destination: {booking.Destination}\n" +
                    $"Date: {booking.StartDate:MMMM dd, yyyy @ HH:mm}\n" +
                    $"Passengers: {booking.NumberOfGuests}\n\n" +
                    $"Vehicle: {vehicle.RegistrationNumber} - {vehicle.Make} {vehicle.Model}\n" +
                    $"Price: KSH {booking.Price:N2}"
                );

                // Create in-app notification for driver
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = driver.Uid,
                    Title = "New Trip Assignment",
                    Message = $"You have been assigned to trip {booking.Id} to {booking.Destination}. Please check your dashboard for details.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(new { message = "Booking assigned successfully" });
        }

        // PUT: api/booking/{id}/reject (Secretary/Admin)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("{id}/reject")]
        public async Task<IActionResult> RejectBooking(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            booking.Status = "REJECTED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Booking Rejected",
                    $"Unfortunately, your booking to {booking.Destination} has been rejected. Please contact support for more information."
                );
            }

            return Ok(new { message = "Booking rejected" });
        }

        // PUT: api/booking/{id}/cancel (Any authenticated user for their own bookings, Admin/Secretary for any)
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelBooking(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));

            // Check permissions
            bool canCancel = profile.Role == "Admin" || profile.Role == "Secretary" || booking.UserId == profile.Uid;
            if (!canCancel)
            {
                return Forbid();
            }

            // Only allow cancellation for bookings that haven't started
            if (booking.Status == "IN_PROGRESS" || booking.Status == "COMPLETED")
            {
                return BadRequest(ApiResponse.Error("Cannot cancel an in-progress or completed booking."));
            }

            booking.Status = "CANCELLED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            // If booking was assigned, make vehicle available again
            if (!string.IsNullOrEmpty(booking.VehicleId))
            {
                var vehicle = await _firestoreService.GetVehicleAsync(booking.VehicleId);
                if (vehicle != null)
                {
                    vehicle.IsAvailable = true;
                    vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
                    await _firestoreService.UpdateVehicleAsync(vehicle);
                }
            }

            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Booking Cancelled",
                    $"Your booking to {booking.Destination} has been cancelled."
                );

                // Create in-app notification for tourist
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Booking Cancelled",
                    Message = $"Your booking to {booking.Destination} has been cancelled.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // If driver was assigned, notify them as well
            if (!string.IsNullOrEmpty(booking.AssignedDriverId))
            {
                var driver = await _firestoreService.GetUserAsync(booking.AssignedDriverId);
                if (driver != null)
                {
                    await _firestoreService.CreateNotificationAsync(new Models.Notification
                    {
                        UserId = driver.Uid,
                        Title = "Trip Cancelled",
                        Message = $"Your assigned trip to {booking.Destination} has been cancelled. The booking is now available for reassignment.",
                        Type = "SYSTEM",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            return Ok(new { message = "Booking cancelled" });
        }

        // PATCH: api/booking/{id}/start (Driver)
        [RoleAuthorize("Driver")]
        [HttpPatch("{id}/start")]
        public async Task<IActionResult> StartTrip(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });

            // only the assigned driver may start and only after they have accepted
            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized();
            if (booking.AssignedDriverId != profile.Uid)
            {
                return Forbid();
            }

            if (booking.Status != "ACCEPTED")
            {
                return BadRequest(ApiResponse.Error("Trip must be accepted before starting."));
            }

            booking.Status = "IN_PROGRESS";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            // Update vehicle status to on-trip
            if (!string.IsNullOrEmpty(booking.VehicleId))
            {
                var vehicle = await _firestoreService.GetVehicleAsync(booking.VehicleId);
                if (vehicle != null)
                {
                    vehicle.Status = "on-trip";
                    vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
                    await _firestoreService.UpdateVehicleAsync(vehicle);
                }
            }

            // notify tourist the driver has started the journey
            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Trip In Progress",
                    $"Your trip to {booking.Destination} is now in progress with driver {profile.FullName}."
                );

                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Trip In Progress",
                    Message = $"Your trip to {booking.Destination} has started. Sit back and relax!",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Create notification for driver
            if (profile != null)
            {
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = profile.Uid,
                    Title = "Trip Started",
                    Message = $"Your trip to {booking.Destination} is now in progress.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(new { message = "Trip started" });
        }

        // PATCH: api/booking/{id}/complete (Driver)
        [RoleAuthorize("Driver")]
        [HttpPatch("{id}/complete")]
        public async Task<IActionResult> CompleteTrip(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized();
            if (booking.AssignedDriverId != profile.Uid)
            {
                return Forbid();
            }

            if (booking.Status != "IN_PROGRESS")
            {
                return BadRequest(ApiResponse.Error("Trip must be in progress before it can be completed."));
            }

            double commission = booking.Price * 0.15;

            var driver = await _firestoreService.GetUserAsync(booking.AssignedDriverId ?? string.Empty);
            if (driver != null)
            {
                driver.CommissionBalance += commission;
                await _firestoreService.UpdateUserAsync(driver);
            }

            // mark completion time so history sorting works correctly
            booking.Status = "COMPLETED";
            booking.EndDate = DateTime.UtcNow;
            booking.CommissionCalculated = true;
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            // Update vehicle status back to available
            if (!string.IsNullOrEmpty(booking.VehicleId))
            {
                var vehicle = await _firestoreService.GetVehicleAsync(booking.VehicleId);
                if (vehicle != null)
                {
                    vehicle.Status = "active";
                    vehicle.IsAvailable = true;
                    vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
                    await _firestoreService.UpdateVehicleAsync(vehicle);
                }
            }

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                // send payment request email if still unpaid
                string subject = "RideHub Trip Completed";
                string message = $"Your trip to {booking.Destination} has been completed.\n\n" +
                                 $"Pickup: {booking.PickupLocation}\n" +
                                 $"Destination: {booking.Destination}\n" +
                                 $"Amount Due: KSH {booking.Price:N2}\n\n";
                if (booking.PaymentStatus != "PAID")
                {
                    message += "Please settle your payment through the app so the trip can appear in your history and for the driver to receive earnings.\n";
                }
                message += "Thank you for riding with RideHub!\nPlease rate your experience and share feedback at your earliest convenience.";

                await _emailService.SendEmail(tourist.Email, subject, message);

                // create an in‑app notification so the tourist can be prompted immediately
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Trip Completed – Payment Due",
                    Message = $"Your trip to {booking.Destination} finished. Please pay KSH {booking.Price:N2} using the dashboard.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Create notification for driver confirming trip completion and commission
            if (profile != null)
            {
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = profile.Uid,
                    Title = "Trip Completed",
                    Message = $"Your trip to {booking.Destination} has been completed. Commission of KSH {(booking.Price * 0.15):N2} has been added to your account.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(new { message = "Trip completed & commission added" });
        }

        // PATCH: api/booking/{id}/payment
        [HttpPatch("{id}/payment")]
        public async Task<IActionResult> MarkAsPaid(string id, [FromBody] UpdatePaymentStatusDTO dto)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            
            booking.PaymentStatus = dto.PaymentStatus;
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Payment Received",
                    $"We have received your payment for the trip to {booking.Destination}. Your booking will now appear in your history. Thank you!"
                );

                // notify tourist about successful payment
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Payment Confirmed",
                    Message = $"Your payment of KSH {booking.Price:N2} for the trip to {booking.Destination} has been received.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // also notify the driver that the fare has been paid (use assigned driver id if available)
            if (!string.IsNullOrEmpty(booking.AssignedDriverId))
            {
                var driver = await _firestoreService.GetUserAsync(booking.AssignedDriverId);
                if (driver != null)
                {
                    await _firestoreService.CreateNotificationAsync(new Models.Notification
                    {
                        UserId = driver.Uid,
                        Title = "Trip Paid",
                        Message = $"The passenger has settled the payment (KSH {booking.Price:N2}) for the trip to {booking.Destination}.",
                        Type = "SYSTEM",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            return Ok(new { message = "Payment successful" });
        }
        // ... existing administrative endpoints remain unchanged
        
        // DRIVER ACTIONS

        // PATCH: api/booking/{id}/accept (Driver)
        [RoleAuthorize("Driver")]
        [HttpPatch("{id}/accept")]
        public async Task<IActionResult> AcceptTrip(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));
            if (booking.AssignedDriverId != profile.Uid)
            {
                return Forbid();
            }

            if (booking.Status != "ASSIGNED")
            {
                return BadRequest(ApiResponse.Error("Only assigned trips can be accepted."));
            }

            booking.Status = "ACCEPTED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            // notify tourist driver has accepted (optional)
            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Driver Accepted Your Trip",
                    $"Your driver has accepted the trip to {booking.Destination}. Please be ready at the pickup location."
                );

                // Create in-app notification for tourist
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Trip Accepted",
                    Message = $"Your driver ({profile.FullName ?? "Your Driver"}) has accepted the trip to {booking.Destination}. Please be ready at the pickup location.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Create notification for driver confirming acceptance
            if (profile != null)
            {
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = profile.Uid,
                    Title = "Trip Accepted",
                    Message = $"You have accepted the trip to {booking.Destination}. Get ready to start when the passenger arrives.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(new { message = "Trip accepted" });
        }

        // PATCH: api/booking/{id}/decline (Driver)
        [RoleAuthorize("Driver")]
        [HttpPatch("{id}/decline")]
        public async Task<IActionResult> DeclineTrip(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));
            if (booking.AssignedDriverId != profile.Uid)
            {
                return Forbid();
            }

            // reset status so an admin/secretary can reassign
            booking.Status = "APPROVED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            // notify tourist driver declined (optional)
            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Driver Declined Your Trip",
                    $"The previously assigned driver was unable to accept your trip to {booking.Destination}. We will reassign a new driver shortly."
                );

                // Create in-app notification for tourist
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = tourist.Uid,
                    Title = "Trip Declined",
                    Message = $"Your assigned driver has declined the trip to {booking.Destination}. We will reassign another driver shortly.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Create notification for driver confirming the decline
            if (profile != null)
            {
                await _firestoreService.CreateNotificationAsync(new Models.Notification
                {
                    UserId = profile.Uid,
                    Title = "Trip Declined - Confirmed",
                    Message = $"You have successfully declined the trip to {booking.Destination}. It will be reassigned to another driver.",
                    Type = "SYSTEM",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return Ok(new { message = "Trip declined" });
        }

        // PUT: api/booking/{id} (Admin/Secretary only - Update booking details)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBooking(string id, [FromBody] UpdateBookingDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));

            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));

            // Only allow updates for bookings that haven't started or completed
            if (booking.Status == "COMPLETED" || booking.Status == "CANCELLED")
            {
                return BadRequest(ApiResponse.Error("Cannot update completed or cancelled bookings."));
            }

            // Update booking fields
            booking.PickupLocation = dto.PickupLocation ?? booking.PickupLocation;
            booking.Destination = dto.Destination ?? booking.Destination;
            booking.StartDate = dto.StartDate ?? booking.StartDate;
            booking.NumberOfGuests = dto.NumberOfGuests ?? booking.NumberOfGuests;
            booking.Price = dto.Price ?? booking.Price;
            booking.SpecialRequests = dto.SpecialRequests ?? booking.SpecialRequests;
            booking.BookingType = dto.BookingType ?? booking.BookingType;
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            await _firestoreService.UpdateBookingAsync(booking);

            // Notify the tourist about the update
            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Booking Updated",
                    $"Your booking to {booking.Destination} has been updated. Please check the details in your dashboard."
                );
            }

            return Ok(ApiResponse<object>.Ok(new { id }, "Booking updated successfully."));
        }

        // PUT: api/booking/{id}/update-status (Admin/Secretary)
        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("{id}/update-status")]
        public async Task<IActionResult> UpdateBookingStatus(string id, [FromBody] UpdateBookingStatusRequest request)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var profile = await GetCurrentUserProfileAsync();
            if (profile == null) return Unauthorized(ApiResponse.Error("Unauthorized"));

            string oldStatus = booking.Status;
            booking.Status = request.Status;
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            // If completing the booking, calculate commission if not already calculated
            if (request.Status == "COMPLETED" && !booking.CommissionCalculated && booking.AssignedDriverId != null)
            {
                double commission = booking.Price * 0.15; // 15% commission

                var driver = await _firestoreService.GetUserAsync(booking.AssignedDriverId);
                if (driver != null)
                {
                    driver.CommissionBalance += commission;
                    await _firestoreService.UpdateUserAsync(driver);
                }

                booking.CommissionCalculated = true;
            }

            // If status changed from ASSIGNED to something else, make vehicle available again
            if (oldStatus == "ASSIGNED" && request.Status != "ASSIGNED" && !string.IsNullOrEmpty(booking.VehicleId))
            {
                var vehicle = await _firestoreService.GetVehicleAsync(booking.VehicleId);
                if (vehicle != null)
                {
                    vehicle.IsAvailable = true;
                    vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
                    await _firestoreService.UpdateVehicleAsync(vehicle);
                }
            }

            await _firestoreService.UpdateBookingAsync(booking);

            // Send notification emails based on status change
            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                string subject = $"RideHub Booking Status Updated";
                string message = $"Your booking to {booking.Destination} status has been updated to {request.Status}.";

                if (request.Status == "COMPLETED")
                {
                    message += " Thank you for riding with RideHub!";
                }

                await _emailService.SendEmail(tourist.Email, subject, message);
            }

            return Ok(new { message = $"Status updated to {request.Status}" });
        }
    }
}
