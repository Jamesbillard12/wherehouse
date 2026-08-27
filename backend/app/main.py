from fastapi import FastAPI

app = FastAPI(
    title="WhereHouse API",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


@app.get("/api/v1/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "wherehouse-api"}
