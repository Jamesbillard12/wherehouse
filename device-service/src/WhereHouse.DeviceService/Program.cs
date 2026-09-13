var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () =>
{
    return new
    {
        Status = "healthy",
        Service = "WhereHouse.DeviceService"
    };
});

app.Run();
