using CareSlot.API.Hubs;
using CareSlot.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register SignalR for real-time slot synchronization
builder.Services.AddSignalR();

// Register Clean Architecture Infrastructure (EF Core & Encryption)
builder.Services.AddInfrastructure(builder.Configuration);

// Configure CORS for Angular frontend and SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors("AllowAngularApp");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

// Map SignalR Hub
app.MapHub<SchedulingHub>("/hubs/scheduling");

app.Run();
