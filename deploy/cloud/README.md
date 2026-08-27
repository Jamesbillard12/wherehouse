# Cloud deployment

The cloud architecture uses the same clients and FastAPI contract as a self-hosted installation.

## Intended shape

- React/Vite static web build on Netlify or equivalent
- Containerized FastAPI service on a Python/container host
- Managed PostgreSQL
- S3-compatible object storage

The React client must depend only on the versioned API contract, not on a specific cloud provider.
