using System.ComponentModel.DataAnnotations;

namespace RideHub.Api.DTOs
{
    public class UpdateProfileDTO
    {
        public string? FullName { get; set; }

        [EmailAddress]
        public string? Email { get; set; }

        [Phone]
        public string? PhoneNumber { get; set; }

        public string? LicenseNumber { get; set; }

        // Password change fields
        public string? CurrentPassword { get; set; }

        public string? NewPassword { get; set; }
    }

    public class ChangePasswordDTO
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
