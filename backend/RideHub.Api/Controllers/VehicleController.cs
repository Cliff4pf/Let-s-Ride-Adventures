using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.Services;
using RideHub.Api.Attributes;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [RoleAuthorize("Admin", "Secretary")]
    [ApiController]
    [Route("api/[controller]")]
    public class VehicleController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public VehicleController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        // Helper to get current user UID
        private string? GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        }

        // Helper to check if user is Admin
        private async Task<bool> IsAdminAsync()
        {
            var uid = GetCurrentUserId();
            if (string.IsNullOrEmpty(uid)) return false;
            var profile = await _firestoreService.GetUserAsync(uid);
            return profile?.Role == "Admin";
        }

        [HttpPost]
        public async Task<IActionResult> AddVehicle([FromBody] Vehicle vehicle)
        {

             if (string.IsNullOrEmpty(vehicle.RegistrationNumber)) return BadRequest("Registration Number is required.");
             
             string id = await _firestoreService.AddVehicleAsync(vehicle);
             return Ok(new { id, message = "Vehicle added successfully" });
        }

        [HttpGet]
        public async Task<IActionResult> GetVehicles()
        {
            var vehicles = await _firestoreService.GetAllVehiclesAsync();
            return Ok(vehicles);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetVehicle(string id)
        {
            var vehicle = await _firestoreService.GetVehicleAsync(id);
            if (vehicle == null) return NotFound();
            return Ok(vehicle);
        }

        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("{id}/activate")]
        public async Task<IActionResult> ActivateVehicle(string id)
        {
            var vehicle = await _firestoreService.GetVehicleAsync(id);
            if (vehicle == null) return NotFound("Vehicle not found");
            
            vehicle.Status = "active";
            vehicle.IsAvailable = true;
            await _firestoreService.UpdateVehicleAsync(vehicle);
            return Ok(new { message = "Vehicle activated" });
        }

        [RoleAuthorize("Admin", "Secretary")]
        [HttpPut("{id}/deactivate")]
        public async Task<IActionResult> DeactivateVehicle(string id)
        {
            var vehicle = await _firestoreService.GetVehicleAsync(id);
            if (vehicle == null) return NotFound("Vehicle not found");
            
            vehicle.Status = "maintenance";
            vehicle.IsAvailable = false;
            await _firestoreService.UpdateVehicleAsync(vehicle);
            return Ok(new { message = "Vehicle deactivated" });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateVehicle(string id, [FromBody] Vehicle vehicle)
        {
            if (id != vehicle.Id) return BadRequest("ID mismatch");

            await _firestoreService.UpdateVehicleAsync(vehicle);
            return Ok(new { message = "Vehicle updated successfully" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVehicle(string id)
        {
            await _firestoreService.DeleteVehicleAsync(id);
            return Ok(new { message = "Vehicle deleted successfully" });
        }

        [RoleAuthorize("Admin", "Secretary")]
        [HttpPatch("{id}/assign-driver")]
        public async Task<IActionResult> AssignDriver(string id, [FromBody] AssignDriverRequest request)
        {
            var vehicle = await _firestoreService.GetVehicleAsync(id);
            if (vehicle == null) return NotFound("Vehicle not found");

            var driver = await _firestoreService.GetUserAsync(request.DriverId);
            if (driver == null || driver.Role != "Driver") return BadRequest("Invalid driver");

            vehicle.AssignedDriverId = request.DriverId;
            await _firestoreService.UpdateVehicleAsync(vehicle);
            return Ok(new { message = "Driver assigned to vehicle successfully" });
        }

        [RoleAuthorize("Admin", "Secretary")]
        [HttpPatch("{id}/unassign-driver")]
        public async Task<IActionResult> UnassignDriver(string id)
        {
            var vehicle = await _firestoreService.GetVehicleAsync(id);
            if (vehicle == null) return NotFound("Vehicle not found");

            vehicle.AssignedDriverId = null;
            await _firestoreService.UpdateVehicleAsync(vehicle);
            return Ok(new { message = "Driver unassigned from vehicle successfully" });
        }
    }

    public class AssignDriverRequest
    {
        public string DriverId { get; set; } = string.Empty;
    }
}
