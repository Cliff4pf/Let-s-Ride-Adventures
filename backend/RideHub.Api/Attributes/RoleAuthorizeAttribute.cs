using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RideHub.Api.Services;
using System.Security.Claims;

namespace RideHub.Api.Attributes
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, Inherited = true, AllowMultiple = true)]
    public class RoleAuthorizeAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string[] _allowedRoles;

        public RoleAuthorizeAttribute(params string[] roles)
        {
            _allowedRoles = roles;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;
            if (!user.Identity?.IsAuthenticated ?? true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Extract uid
            var uid = user.FindFirst("user_id")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uid))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Resolve FirestoreService from DI
            var firestoreService = context.HttpContext.RequestServices.GetService<FirestoreService>();
            if (firestoreService == null)
            {
                context.Result = new StatusCodeResult(500);
                return;
            }

            var profile = await firestoreService.GetUserAsync(uid);
            if (profile == null)
            {
                context.Result = new ForbidResult(); // No profile means no role
                return;
            }

            if (!_allowedRoles.Contains(profile.Role))
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
