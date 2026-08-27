# Raspberry Pi deployment

WhereHouse is designed to run as ARM64 Docker containers on a Raspberry Pi.

## Target

- Raspberry Pi 4 with 4 GB RAM minimum
- Raspberry Pi 5 with 8 GB RAM preferred
- 64-bit Raspberry Pi OS
- SSD storage strongly preferred for PostgreSQL and item photos
- Docker Engine with Docker Compose

## Initial local deployment

From the repository root:

```bash
docker compose up --build -d
```

The web application is exposed on port `8080` by default.

Future work will add mDNS discovery, HTTPS/local certificates, backups, upgrades, and a production Pi installer.
