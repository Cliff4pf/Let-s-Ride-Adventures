using Microsoft.AspNetCore.Mvc;
using RideHub.Api.Models;
using RideHub.Api.Services;
using RideHub.Api.Attributes;
using System.Linq;

namespace RideHub.Api.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [RoleAuthorize("Admin", "Secretary")]
    [ApiController]
    [Route("api/[controller]")]
    public class DriverController : ControllerBase
    {
        private readonly FirestoreService _firestoreService;

        public DriverController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllDrivers()
        {
            var drivers = await _firestoreService.GetUsersByRoleAsync("Driver");
            return Ok(drivers);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDriver(string id)
        {
            var driver = await _firestoreService.GetUserAsync(id);
            if (driver == null || driver.Role != "Driver") return NotFound();
            return Ok(driver);
        }

        [HttpPost]
        public async Task<IActionResult> AddDriver([FromBody] User driver)
        {
            if (string.IsNullOrEmpty(driver.FullName)) return BadRequest("Full Name is required.");
            if (string.IsNullOrEmpty(driver.LicenseNumber)) return BadRequest("License Number is required.");

            driver.Role = "Driver";
            if (string.IsNullOrEmpty(driver.Uid))
            {
                driver.Uid = System.Guid.NewGuid().ToString(); 
            }
            
            await _firestoreService.CreateUserAsync(driver);
            return CreatedAtAction(nameof(GetDriver), new { id = driver.Uid }, new { id = driver.Uid });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDriver(string id, [FromBody] User driver)
        {
            if (id != driver.Uid) return BadRequest("ID mismatch");
            driver.Role = "Driver";
            
            await _firestoreService.UpdateUserAsync(driver);
            return Ok(new { message = "Driver updated successfully" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDriver(string id)
        {
            var driver = await _firestoreService.GetUserAsync(id);
            if (driver != null)
            {
                 driver.Status = "Suspended";
                 await _firestoreService.UpdateUserAsync(driver);
            }
            return Ok(new { message = "Driver deactivated successfully" });
        }
    }
}
