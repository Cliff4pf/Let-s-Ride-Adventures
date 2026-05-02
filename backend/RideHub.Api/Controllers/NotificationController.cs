using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.Services;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public NotificationController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        // GET: api/notification
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications()
        {
            try
            {
                var profile = await GetCurrentUserProfileAsync();
                if (profile == null) 
                    return Unauthorized(new { success = false, message = "Unauthorized" });

                var list = await _firestoreService.GetNotificationsByUserAsync(profile.Uid);
                return Ok(new { success = true, data = list });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // helper to reuse existing logic from BookingController
        private async Task<User?> GetCurrentUserProfileAsync()
        {
            // since BookingController has this method, we just replicate the needed logic here
            var auth = HttpContext.User;
            if (auth == null || auth.Identity?.IsAuthenticated != true) return null;
            var uid = auth.FindFirst("uid")?.Value ?? string.Empty;
            if (string.IsNullOrEmpty(uid)) return null;
            return await _firestoreService.GetUserAsync(uid);
        }
    }
}
