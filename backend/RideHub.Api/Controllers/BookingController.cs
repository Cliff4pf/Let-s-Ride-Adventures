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
                VehiclePreference = dto.VehiclePreference ?? dto.VehicleType,
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
            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));

            var booking = await _firestoreService.GetBookingAsync(dto.BookingId);
            if (booking == null) return NotFound(ApiResponse.Error("Booking not found."));

            var driver = await _firestoreService.GetUserAsync(dto.DriverId);
            if (driver == null) return NotFound(ApiResponse.Error("Driver not found."));

            var vehicle = await _firestoreService.GetVehicleAsync(dto.VehicleId);
            if (vehicle == null) return NotFound(ApiResponse.Error("Vehicle not found."));

            // Check if vehicle is available
            if (!vehicle.IsAvailable)
            {
                return BadRequest(ApiResponse.Error("Vehicle is not available."));
            }

            // Check if driver is active
            if (driver.Status != "Active")
            {
                return BadRequest(ApiResponse.Error("Driver is not active."));
            }

            booking.AssignedDriverId = dto.DriverId;
            booking.VehicleId = dto.VehicleId;
            booking.Status = "ASSIGNED";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            // Mark vehicle as unavailable
            vehicle.IsAvailable = false;
            vehicle.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            await _firestoreService.UpdateBookingAsync(booking);
            await _firestoreService.UpdateVehicleAsync(vehicle);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);

            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Assignment Complete",
                    $"Your trip to {booking.Destination} has been assigned. Driver: {driver.FullName}, Vehicle: {vehicle.RegistrationNumber} ({vehicle.Model})."
                );
            }

            if (driver != null)
            {
                await _emailService.SendEmail(
                    driver.Email,
                    "RideHub New Assignment",
                    $"You have been assigned to trip {booking.Id} to {booking.Destination}. Vehicle: {vehicle.RegistrationNumber} ({vehicle.Model})."
                );
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

            booking.Status = "IN_PROGRESS";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            return Ok(new { message = "Trip started" });
        }

        // PATCH: api/booking/{id}/complete (Driver)
        [RoleAuthorize("Driver")]
        [HttpPatch("{id}/complete")]
        public async Task<IActionResult> CompleteTrip(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });

            double commission = booking.Price * 0.15;

            var driver = await _firestoreService.GetUserAsync(booking.AssignedDriverId ?? string.Empty);
            if (driver != null)
            {
                driver.CommissionBalance += commission;
                await _firestoreService.UpdateUserAsync(driver);
            }

            booking.Status = "COMPLETED";
            booking.CommissionCalculated = true;
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Trip Completed",
                    $"Your trip to {booking.Destination} has been completed. Thank you for riding with RideHub!"
                );
            }

            return Ok(new { message = "Trip completed & commission added" });
        }

        // PATCH: api/booking/{id}/payment
        [HttpPatch("{id}/payment")]
        public async Task<IActionResult> MarkAsPaid(string id)
        {
            var booking = await _firestoreService.GetBookingAsync(id);
            if (booking == null) return NotFound(new { message = "Booking not found." });
            
            booking.PaymentStatus = "PAID";
            booking.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            
            await _firestoreService.UpdateBookingAsync(booking);

            var tourist = await _firestoreService.GetUserAsync(booking.UserId);
            if (tourist != null)
            {
                await _emailService.SendEmail(
                    tourist.Email,
                    "RideHub Payment Received",
                    $"We have received your payment for the trip to {booking.Destination}. Thank you!"
                );
            }

            return Ok(new { message = "Payment successful" });
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
        }    }
}
