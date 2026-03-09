using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.DTOs;
using RideHub.Api.Services;
using RideHub.Api.Attributes;
using FirebaseAdmin.Auth;

namespace RideHub.Api.Controllers
{
    public class RoleUpdateRequest
    {
        public string Role { get; set; } = string.Empty;
    }

    public class StatusUpdateRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;
        private readonly EmailService _emailService;

        public UserController(FirestoreService firestoreService, EmailService emailService)
        {
            _firestoreService = firestoreService;
            _emailService = emailService;
        }

        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> RegisterUser([FromBody] RegisterUserDTO request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));
            
            var email = request.Email.Trim().ToLower();

            try
            {
                // 1. Create Firebase Auth User
                var userArgs = new UserRecordArgs
                {
                    Email = email,
                    EmailVerified = false,
                    Password = request.Password,
                    DisplayName = request.FullName,
                    Disabled = false
                };

                UserRecord userRecord = await FirebaseAuth.DefaultInstance.CreateUserAsync(userArgs);

                // 2. Set Custom Claims
                var claims = new Dictionary<string, object>
                {
                    { "role", "Tourist" }
                };
                await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(userRecord.Uid, claims);

                // 3. Create Firestore User Profile
                var profile = new User
                {
                    Uid = userRecord.Uid,
                    Email = email,
                    FullName = request.FullName,
                    PhoneNumber = request.PhoneNumber ?? "",
                    Role = "Tourist",
                    Status = "Active",
                    CommissionBalance = 0,
                    EmailVerified = false,
                    CreatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp()
                };

                try
                {
                    await _firestoreService.CreateUserAsync(profile);
                }
                catch (Exception dbEx)
                {
                    // Rollback Firebase Auth user if Firestore fails
                    await FirebaseAuth.DefaultInstance.DeleteUserAsync(userRecord.Uid);
                    Console.WriteLine($"Firestore error during registration: {dbEx.Message}");
                    return StatusCode(500, ApiResponse.Error("Failed to provision account. Please try again."));
                }

                return Ok(ApiResponse<User>.Ok(profile, "User registered successfully."));
            }
            catch (FirebaseAuthException faEx)
            {
                return BadRequest(ApiResponse.Error($"Registration failed: {faEx.Message}"));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unknown error during registration: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("An unexpected error occurred."));
            }
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var uid = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uid)) return Unauthorized(ApiResponse.Error("Unauthorized access."));

            var profile = await _firestoreService.GetUserAsync(uid);
            if (profile == null) return NotFound(ApiResponse.Error("User profile not found."));

            // Optionally, update LastLogin timestamp here
            profile.LastLogin = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            await _firestoreService.UpdateUserAsync(profile);

            return Ok(ApiResponse<object>.Ok(new {
                uid = profile.Uid,
                fullName = profile.FullName,
                role = profile.Role,
                status = profile.Status,
                commissionBalance = profile.CommissionBalance
            }));
        }

        [HttpPatch("profile/update")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDTO request)
        {
            var uid = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uid)) return Unauthorized(ApiResponse.Error("Unauthorized access."));

            if (!ModelState.IsValid) return BadRequest(ApiResponse.Error("Invalid request data."));

            try
            {
                var profile = await _firestoreService.GetUserAsync(uid);
                if (profile == null) return NotFound(ApiResponse.Error("User profile not found."));

                // Update fields if provided
                if (!string.IsNullOrEmpty(request.FullName))
                    profile.FullName = request.FullName;

                if (!string.IsNullOrEmpty(request.PhoneNumber))
                    profile.PhoneNumber = request.PhoneNumber;

                if (!string.IsNullOrEmpty(request.LicenseNumber))
                    profile.LicenseNumber = request.LicenseNumber;

                profile.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
                await _firestoreService.UpdateUserAsync(profile);

                // Create audit log
                await _firestoreService.CreateAuditLogAsync(new AuditLog
                {
                    ActionType = "PROFILE_UPDATE",
                    EntityId = uid,
                    EntityType = "User",
                    PerformedByUid = uid,
                    Details = "User updated their profile"
                });

                return Ok(ApiResponse<User>.Ok(profile, "Profile updated successfully."));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating profile: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("Failed to update profile."));
            }
        }

        [HttpPatch("{uid}/promote")]
        [RoleAuthorize("Admin")]
        public async Task<IActionResult> PromoteUser(string uid, [FromBody] string newRole)
        {
            var validRoles = new[] { "Tourist", "Driver", "Secretary", "Admin" };

            if (!validRoles.Contains(newRole))
                return BadRequest("Invalid role.");

            // Update Firebase Custom Claim
            await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(uid, new Dictionary<string, object>
            {
                { "role", newRole }
            });

            // Update Firestore user document
            var userRef = await _firestoreService.GetUserAsync(uid);
            if (userRef != null)
            {
                userRef.Role = newRole;
                await _firestoreService.UpdateUserAsync(userRef);
            }

            var adminUid = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            // Write audit log
            await _firestoreService.CreateAuditLogAsync(new AuditLog
            {
                ActionType = "ROLE_CHANGE",
                EntityId = uid,
                EntityType = "User",
                PerformedByUid = adminUid ?? "system",
                Details = $"Role changed to {newRole}"
            });

            if (userRef != null)
            {
                await _emailService.SendEmail(
                    userRef.Email,
                    "RideHub Account Update",
                    $"Your account has been promoted to the role of: {newRole}."
                );
            }

            return Ok(new { message = $"User promoted to {newRole}" });
        }

        [RoleAuthorize("Admin")]
        [HttpPatch("{uid}/suspend")]
        [RoleAuthorize("Admin")]
        public async Task<IActionResult> SuspendUser(string uid)
        {
            await FirebaseAuth.DefaultInstance.UpdateUserAsync(new UserRecordArgs
            {
                Uid = uid,
                Disabled = true
            });

            var userRef = await _firestoreService.GetUserAsync(uid);
            if (userRef != null)
            {
                userRef.Status = "Suspended";
                await _firestoreService.UpdateUserAsync(userRef);
            }

            var adminUid = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            await _firestoreService.CreateAuditLogAsync(new AuditLog
            {
                ActionType = "USER_SUSPENDED",
                EntityId = uid,
                EntityType = "User",
                PerformedByUid = adminUid ?? "system"
            });

            if (userRef != null)
            {
                await _emailService.SendEmail(
                    userRef.Email,
                    "RideHub Account Suspended",
                    "Your RideHub account has been suspended by an administrator. Please contact support for more details."
                );
            }

            return Ok(new { message = "User suspended successfully" });
        }

        [RoleAuthorize("Admin", "Secretary")]
        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _firestoreService.GetAllUsersAsync();
            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(string id)
        {
            var user = await _firestoreService.GetUserAsync(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpGet("makemeadmin")]
        [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> MakeMeAdmin()
        {
            var uid = User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uid)) return Unauthorized("Unauthorized access.");

            await FirebaseAuth.DefaultInstance.SetCustomUserClaimsAsync(uid, new Dictionary<string, object>
            {
                { "role", "Admin" }
            });

            var userRef = await _firestoreService.GetUserAsync(uid);
            if (userRef != null)
            {
                userRef.Role = "Admin";
                await _firestoreService.UpdateUserAsync(userRef);
            }

            return Ok(new { message = "You are now an Admin. Please log out and log back in to refresh your token." });
        }

        [HttpPost("migrate-database")]
        [RoleAuthorize("Admin")]
        public async Task<IActionResult> MigrateDatabase()
        {
            try
            {
                // Migrate users collection
                var userDefaults = new Dictionary<string, object>
                {
                    { "CommissionBalance", 0.0 },
                    { "EmailVerified", false },
                    { "Status", "Active" },
                    { "Role", "Tourist" },
                    { "PhoneNumber", "" },
                    { "FullName", "" },
                    { "Email", "" },
                    { "CreatedAt", Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp() }
                };
                await _firestoreService.MigrateCollectionAsync("users", userDefaults);

                // Migrate vehicles collection
                var vehicleDefaults = new Dictionary<string, object>
                {
                    { "IsAvailable", true },
                    { "Status", "active" },
                    { "SeatingCapacity", 4 },
                    { "PricePerDay", 0.0 },
                    { "Year", 2020 },
                    { "VehicleType", "Sedan" },
                    { "Make", "" },
                    { "Model", "" },
                    { "RegistrationNumber", "" },
                    { "CreatedAt", Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp() }
                };
                await _firestoreService.MigrateCollectionAsync("vehicles", vehicleDefaults);

                // Migrate bookings collection
                var bookingDefaults = new Dictionary<string, object>
                {
                    { "BookingType", "Transfer" },
                    { "ServiceType", "Transport" },
                    { "PickupLocation", "" },
                    { "Destination", "" },
                    { "NumberOfGuests", 1 },
                    { "VehiclePreference", "Any" },
                    { "SpecialRequests", "" },
                    { "Price", 0.0 },
                    { "Status", "PENDING" },
                    { "PaymentStatus", "UNPAID" },
                    { "CommissionCalculated", false },
                    { "CreatedAt", Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp() },
                    { "StartDate", DateTime.UtcNow }
                };
                await _firestoreService.MigrateCollectionAsync("bookings", bookingDefaults);

                // Migrate notifications collection
                var notificationDefaults = new Dictionary<string, object>
                {
                    { "Title", "" },
                    { "Message", "" },
                    { "Type", "SYSTEM" },
                    { "IsRead", false },
                    { "CreatedAt", DateTime.UtcNow }
                };
                await _firestoreService.MigrateCollectionAsync("notifications", notificationDefaults);

                // Migrate auditLogs collection
                var auditLogDefaults = new Dictionary<string, object>
                {
                    { "ActionType", "" },
                    { "EntityId", "" },
                    { "EntityType", "" },
                    { "PerformedByUid", "" },
                    { "Details", "" },
                    { "Timestamp", Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp() }
                };
                await _firestoreService.MigrateCollectionAsync("auditLogs", auditLogDefaults);

                // For metrics, it's a single document, so handle separately
                await _firestoreService.MigrateMetricsAsync();

                return Ok("Database migration completed successfully.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Migration failed: {ex.Message}");
            }
        }
    }
}
