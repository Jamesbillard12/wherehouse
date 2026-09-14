using WhereHouse.DeviceService.Devices;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter()
    );
});

var app = builder.Build();

app.MapGet("/health", () =>
{
    return new
    {
        Status = "healthy",
        Service = "WhereHouse.DeviceService"
    };
});

app.MapGet("/devices", () =>
{
    List<DiscoveredDevice> devices =
    [
        new("usb-brother-1", "Garage Printer", ConnectionType.Usb, "Brother", "QL-800"),
        new("network-brother-1", "Attic Printer", ConnectionType.Network, "Brother", "QA-820NWB"),
        new( "unknown-usb-1", "Unknown USB Device", ConnectionType.Usb, null, null )
    ];
    return devices;
});

app.Run();
