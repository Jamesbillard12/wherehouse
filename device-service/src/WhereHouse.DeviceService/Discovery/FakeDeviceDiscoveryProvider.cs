using WhereHouse.DeviceService.Devices;

namespace WhereHouse.DeviceService.Discovery;

public class FakeDiscoveryProvider : IDeviceDiscoveryProvider
{
    public Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        IReadOnlyList<DiscoveredDevice> devices = [
            new( "usb-brother-1", "Garage Printer", ConnectionType.Usb, "Brother", "QL-800" ), new( "network-brother-1", "Attic Printer", ConnectionType.Network, "Brother", "QL-820NWB" )
        ];
        return Task.FromResult(devices);
    }
}