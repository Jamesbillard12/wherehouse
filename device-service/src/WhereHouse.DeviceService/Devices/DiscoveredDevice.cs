namespace WhereHouse.DeviceService.Devices;

public record DiscoveredDevice(
    string Id,
    string Name,
    ConnectionType ConnectionType,
    string? Manufacturer,
    string? Model
);