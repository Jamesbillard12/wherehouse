from fastapi import APIRouter

from app.api.v1.routes import backups, identifiers, items, locations, system, workspaces

router = APIRouter()
router.include_router(workspaces.router)
router.include_router(locations.router)
router.include_router(items.router)
router.include_router(identifiers.router)
router.include_router(backups.router)
router.include_router(system.router)
