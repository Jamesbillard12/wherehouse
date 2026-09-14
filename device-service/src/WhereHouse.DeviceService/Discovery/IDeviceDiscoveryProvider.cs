using WhereHouse.DeviceService.Devices;

namespace WhereHouse.DeviceService.Discovery;

public interface IDeviceDiscoveryProvider
{
    Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        CancellationToken cancellationToken
    );
}