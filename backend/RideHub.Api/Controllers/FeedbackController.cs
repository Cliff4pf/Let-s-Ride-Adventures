using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using RideHub.Api.Models;
using RideHub.Api.Services;
using System.Linq;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FeedbackController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public FeedbackController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        }

        // POST: api/feedback
        [HttpPost]
        public async Task<IActionResult> CreateFeedback([FromBody] Feedback feedback)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse.Error("Invalid feedback data."));

            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse.Error("Unauthorized"));

            feedback.UserId = userId;
            feedback.CreatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            string id = await _firestoreService.AddFeedbackAsync(feedback);
            return Ok(ApiResponse<object>.Ok(new { id }, "Feedback submitted successfully."));
        }

        // GET: api/feedback
        [HttpGet]
        [Authorize(Roles = "Admin,Secretary")]
        public async Task<IActionResult> GetAllFeedback()
        {
            var feedbackList = await _firestoreService.GetAllFeedbackAsync();
            return Ok(feedbackList);
        }

        // GET: api/feedback/for/{userId}
        [HttpGet("for/{userId}")]
        public async Task<IActionResult> GetFeedbackForUser(string userId)
        {
            var feedbackList = await _firestoreService.GetFeedbackForUserAsync(userId);
            if (!feedbackList.Any())
                return Ok(new List<Feedback>());

            var averageRating = feedbackList.Average(f => f.Rating);
            return Ok(new
            {
                feedback = feedbackList,
                averageRating = Math.Round(averageRating, 2),
                count = feedbackList.Count
            });
        }

        // GET: api/feedback/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetFeedback(string id)
        {
            var feedback = await _firestoreService.GetFeedbackAsync(id);
            if (feedback == null)
                return NotFound(ApiResponse.Error("Feedback not found."));

            return Ok(feedback);
        }

        // PUT: api/feedback/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFeedback(string id, [FromBody] Feedback feedback)
        {
            if (id != feedback.Id)
                return BadRequest(ApiResponse.Error("ID mismatch."));

            var userId = GetCurrentUserId();
            var existingFeedback = await _firestoreService.GetFeedbackAsync(id);

            if (existingFeedback == null)
                return NotFound(ApiResponse.Error("Feedback not found."));

            if (existingFeedback.UserId != userId)
                return Forbid("You can only edit your own feedback.");

            feedback.UserId = userId;
            feedback.CreatedAt = existingFeedback.CreatedAt;
            feedback.UpdatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();

            await _firestoreService.UpdateFeedbackAsync(feedback);
            return Ok(ApiResponse.Ok("Feedback updated successfully."));
        }

        // DELETE: api/feedback/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFeedback(string id)
        {
            var userId = GetCurrentUserId();
            var feedback = await _firestoreService.GetFeedbackAsync(id);

            if (feedback == null)
                return NotFound(ApiResponse.Error("Feedback not found."));

            if (feedback.UserId != userId)
                return Forbid("You can only delete your own feedback.");

            await _firestoreService.DeleteFeedbackAsync(id);
            return Ok(ApiResponse.Ok("Feedback deleted successfully."));
        }

        // GET: api/feedback/stats/{userId}
        [HttpGet("stats/{userId}")]
        public async Task<IActionResult> GetUserStats(string userId)
        {
            var feedbackList = await _firestoreService.GetFeedbackForUserAsync(userId);

            if (!feedbackList.Any())
                return Ok(new
                {
                    averageRating = 0,
                    totalReviews = 0,
                    ratingDistribution = new { five = 0, four = 0, three = 0, two = 0, one = 0 }
                });

            var averageRating = feedbackList.Average(f => f.Rating);
            var ratingDistribution = new
            {
                five = feedbackList.Count(f => f.Rating == 5),
                four = feedbackList.Count(f => f.Rating == 4),
                three = feedbackList.Count(f => f.Rating == 3),
                two = feedbackList.Count(f => f.Rating == 2),
                one = feedbackList.Count(f => f.Rating == 1)
            };

            return Ok(new
            {
                averageRating = Math.Round(averageRating, 2),
                totalReviews = feedbackList.Count,
                ratingDistribution = ratingDistribution
            });
        }
    }
}
