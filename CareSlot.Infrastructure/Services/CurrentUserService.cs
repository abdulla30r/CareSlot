using System.Security.Claims;
using CareSlot.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace CareSlot.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId => 
        _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
        ?? _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;

    public string? Role => 
        _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value 
        ?? _httpContextAccessor.HttpContext?.User?.FindFirst("role")?.Value;

    public string? Name => 
        _httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Name)?.Value;

    public bool IsAuthenticated => 
        _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false;
}

