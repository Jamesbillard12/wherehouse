from fastapi import APIRouter

from app.api.v1.routes import households, items, locations

router = APIRouter()
router.include_router(households.router)
router.include_router(locations.router)
router.include_router(items.router)
