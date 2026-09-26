using WhereHouse.DeviceService.Devices;

namespace WhereHouse.DeviceService.Discovery;

public class FakeDiscoveryProvider : IDeviceDiscoveryProvider
{
    public async Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        CancellationToken cancellationToken
    )
    {
        await Task.Delay(
            500,
            cancellationToken
        );
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
        return devices;
    }
}
