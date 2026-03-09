using System.ComponentModel.DataAnnotations;

namespace RideHub.Api.DTOs
{
    public class UpdateProfileDTO
    {
        public string? FullName { get; set; }

        [Phone]
        public string? PhoneNumber { get; set; }

        public string? LicenseNumber { get; set; }
    }
}
