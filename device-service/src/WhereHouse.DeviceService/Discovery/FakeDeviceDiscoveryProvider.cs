using WhereHouse.DeviceService.Devices;

namespace WhereHouse.DeviceService.Discovery;

public class FakeDiscoveryProvider : IDeviceDiscoveryProvider
{
    private readonly ILogger<FakeDiscoveryProvider> _logger;

    public FakeDiscoveryProvider(
        ILogger<FakeDiscoveryProvider> logger
    )
    {
        _logger = logger;
    }
    public async Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Starting fake device discovery"
        );

        try
        {
            await Task.Delay(
                500,
                cancellationToken
            );
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning(
                "Fake device discovery was cancelled"
            );

            throw;
        }


        IReadOnlyList<DiscoveredDevice> devices = [
            new(
            "usb-brother-1",
            "Garage Printer",
            ConnectionType.Usb,
            "Brother",
            "QL-800"
        ), new(
            "network-brother-1",
            "Attic Printer",
            ConnectionType.Network,
            "Brother",
            "QL-820NWB"
        )
        ];
        _logger.LogInformation(
            "Fake device discovery found {DeviceCount} devices",
            devices.Count
        );
        return devices;
    }
}
