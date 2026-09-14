using System.Text.Json.Serialization;
using WhereHouse.DeviceService.Devices;
using WhereHouse.DeviceService.Discovery;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

app.MapGet(
    "/health",
    () =>
    {
        return new { Status = "healthy", Service = "WhereHouse.DeviceService" };
    }
);

IDeviceDiscoveryProvider discoveryProvider = new FakeDiscoveryProvider();

app.MapGet(
    "/devices",
    async (ConnectionType? connectionType, CancellationToken cancellationToken) =>
    {
        var devices = await discoveryProvider.DiscoverAsync(cancellationToken);

        IEnumerable<DiscoveredDevice> query = devices;

        if (connectionType is not null)
        {
            query = query.Where(device => device.ConnectionType == connectionType);
        }

        return query.OrderBy(device => device.Name).ToList();
    }
);

app.Run();
