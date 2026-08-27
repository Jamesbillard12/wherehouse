from fastapi import APIRouter

from app.api.v1.core import router as core_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(core_router, tags=["core"])
