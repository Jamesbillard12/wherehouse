# WhereHouse

**Know what you have. Know where it is.**

WhereHouse is a household inventory, storage, lending, transfer, and activity-preparation platform. It is designed to run either self-hosted on a Raspberry Pi or in the cloud while using the same API and client applications.

## Core goals

- Track household items and exactly where they are stored.
- Model areas, zones, containers, nested container placement, and items.
- Scan QR codes from the companion app to find, move, check out, and return items.
- Use AI-assisted photo analysis to propose item details and storage locations.
- Track item custody with checkouts and item movement with transfers.
- Support reusable activity/loadout checklists such as camping trips.
- Work offline in the companion app and synchronize when connectivity returns.
- Generate printable QR labels for containers and items.
- Support both Raspberry Pi self-hosting and cloud deployment.

## Technology

| Layer | Technology |
| --- | --- |
| Web | React + Vite + TypeScript |
| Companion | React Native + Expo + TypeScript |
| API | Python + FastAPI |
| Validation | Pydantic |
| ORM | SQLAlchemy 2 |
| Migrations | Alembic |
| Server database | PostgreSQL |
| Companion database | SQLite |
| Python tooling | uv, Ruff, Pytest |
| TypeScript tooling | pnpm, Vitest |
| API contract | OpenAPI-generated TypeScript client |
| Local deployment | Docker Compose + Caddy |
| Cloud web hosting | Netlify-compatible static build |
| Cloud API | Containerized FastAPI deployment |
| Object storage | Local filesystem or S3-compatible provider |

## Repository layout

```text
wherehouse/
├── apps/
│   ├── web/
│   └── mobile/
├── backend/
├── packages/
│   └── api-client/
├── deploy/
│   ├── docker/
│   ├── raspberry-pi/
│   └── cloud/
├── docs/
│   ├── architecture.md
│   ├── domain-model.md
│   └── mvp.md
├── docker-compose.yml
└── README.md
```

## Documentation

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [MVP](docs/mvp.md)

## Status

Early architecture and product design. Implementation scaffold is next.
