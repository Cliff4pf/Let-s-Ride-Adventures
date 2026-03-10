using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.Services;
using System.Linq;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class MessageController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public MessageController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirst("user_id")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        }

        // POST: api/message/send
        [HttpPost("send")]
        public async Task<IActionResult> SendMessage([FromBody] Message message)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse.Error("Invalid message data."));

            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse.Error("Unauthorized"));

            if (string.IsNullOrEmpty(message.Content))
                return BadRequest(ApiResponse.Error("Message content cannot be empty."));

            if (string.IsNullOrEmpty(message.RecipientId))
                return BadRequest(ApiResponse.Error("Recipient ID is required."));

            message.SenderId = userId;
            message.CreatedAt = Google.Cloud.Firestore.Timestamp.GetCurrentTimestamp();
            message.IsRead = false;

            string id = await _firestoreService.AddMessageAsync(message);
            return Ok(ApiResponse<object>.Ok(new { id }, "Message sent successfully."));
        }

        // GET: api/message/inbox
        [HttpGet("inbox")]
        public async Task<IActionResult> GetInbox()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse.Error("Unauthorized"));

            var messages = await _firestoreService.GetUserMessagesAsync(userId);
            
            // Group by sender to show conversations
            var conversations = messages
                .GroupBy(m => m.SenderId)
                .Select(g => new
                {
                    senderId = g.Key,
                    lastMessage = g.OrderByDescending(m => m.CreatedAt).First().Content,
                    lastMessageTime = g.OrderByDescending(m => m.CreatedAt).First().CreatedAt,
                    unreadCount = g.Count(m => !m.IsRead)
                })
                .OrderByDescending(c => c.lastMessageTime)
                .ToList();

            return Ok(conversations);
        }

        // GET: api/message/conversation/{userId}
        [HttpGet("conversation/{userId}")]
        public async Task<IActionResult> GetConversation(string userId)
        {
            var currentUserId = GetCurrentUserId();
            if (string.IsNullOrEmpty(currentUserId))
                return Unauthorized(ApiResponse.Error("Unauthorized"));

            var messages = await _firestoreService.GetConversationAsync(currentUserId, userId);
            
            // Mark all messages from the other user as read
            foreach (var msg in messages.Where(m => m.SenderId == userId && !m.IsRead))
            {
                await _firestoreService.MarkMessageAsReadAsync(msg.Id);
            }

            return Ok(messages);
        }

        // GET: api/message/unread
        [HttpGet("unread")]
        public async Task<IActionResult> GetUnreadMessages()
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse.Error("Unauthorized"));

            var unreadMessages = await _firestoreService.GetUnreadMessagesAsync(userId);
            return Ok(new
            {
                count = unreadMessages.Count,
                messages = unreadMessages.Take(10).ToList()
            });
        }

        // PUT: api/message/{id}/read
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(string id)
        {
            var message = await _firestoreService.GetMessageAsync(id);
            if (message == null)
                return NotFound(ApiResponse.Error("Message not found."));

            var userId = GetCurrentUserId();
            if (message.RecipientId != userId)
                return Forbid("You can only mark your own messages as read.");

            await _firestoreService.MarkMessageAsReadAsync(id);
            return Ok(ApiResponse.Ok("Message marked as read."));
        }

        // DELETE: api/message/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMessage(string id)
        {
            var message = await _firestoreService.GetMessageAsync(id);
            if (message == null)
                return NotFound(ApiResponse.Error("Message not found."));

            var userId = GetCurrentUserId();
            if (message.SenderId != userId && message.RecipientId != userId)
                return Forbid("You can only delete your own messages.");

            await _firestoreService.DeleteMessageAsync(id);
            return Ok(ApiResponse.Ok("Message deleted successfully."));
        }

        // GET: api/message/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetMessage(string id)
        {
            var message = await _firestoreService.GetMessageAsync(id);
            if (message == null)
                return NotFound(ApiResponse.Error("Message not found."));

            return Ok(message);
        }
    }
}
