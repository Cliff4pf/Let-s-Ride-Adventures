using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.Services;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public AuditLogController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        }

        // GET: api/auditlog
        [HttpGet]
        public async Task<IActionResult> GetAuditLogs([FromQuery] int limit = 100)
        {
            try
            {
                var logs = await _firestoreService.GetAuditLogsAsync(limit);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching audit logs: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("Failed to fetch audit logs."));
            }
        }

        // GET: api/auditlog/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetAuditLogsByUser(string userId)
        {
            try
            {
                var logs = await _firestoreService.GetAuditLogsByUserAsync(userId);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching audit logs for user: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("Failed to fetch audit logs."));
            }
        }

        // GET: api/auditlog/action/{actionType}
        [HttpGet("action/{actionType}")]
        public async Task<IActionResult> GetAuditLogsByAction(string actionType)
        {
            try
            {
                var logs = await _firestoreService.GetAuditLogsByActionAsync(actionType);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching audit logs by action: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("Failed to fetch audit logs."));
            }
        }

        // GET: api/auditlog/my
        [HttpGet("my")]
        public async Task<IActionResult> GetMyAuditLogs()
        {
            var uid = GetCurrentUserId();
            if (string.IsNullOrEmpty(uid)) return Unauthorized(ApiResponse.Error("Unauthorized access."));

            try
            {
                var logs = await _firestoreService.GetAuditLogsByUserAsync(uid);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching my audit logs: {ex.Message}");
                return StatusCode(500, ApiResponse.Error("Failed to fetch audit logs."));
            }
        }
    }
}
