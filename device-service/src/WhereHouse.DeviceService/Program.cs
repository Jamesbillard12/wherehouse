using System.Text.Json.Serialization;
using WhereHouse.DeviceService.Devices;

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

app.MapGet("/devices", (ConnectionType? connectionType) =>
{
    List<DiscoveredDevice> devices =
    [
        new(
            "usb-brother-1",
            "Garage Printer",
            ConnectionType.Usb,
            "Brother",
            "QL-800"
        ),
        new(
            "network-brother-1",
            "Attic Printer",
            ConnectionType.Network,
            "Brother",
            "QL-820NWB"
        )
    ];

    IEnumerable<DiscoveredDevice> query = devices;

    if (connectionType is not null)
    {
        query = query.Where(device => device.ConnectionType == connectionType);
    }

    return query.OrderBy(device => device.Name).ToList();
});

app.Run();
