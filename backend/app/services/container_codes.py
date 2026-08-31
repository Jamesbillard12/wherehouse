from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import ContainerType

CONTAINER_CODE_PREFIXES = {
    ContainerType.BIN.value: "BIN",
    ContainerType.BOX.value: "BOX",
    ContainerType.SHELF.value: "SHF",
    ContainerType.SHELVING_UNIT.value: "SHU",
    ContainerType.CABINET.value: "CAB",
    ContainerType.DRAWER.value: "DRW",
    ContainerType.TOOLBOX.value: "TLB",
    ContainerType.BAG.value: "BAG",
    ContainerType.CASE.value: "CSE",
    ContainerType.RACK.value: "RCK",
    ContainerType.HOOK.value: "HOK",
    ContainerType.WORKBENCH.value: "WRK",
    ContainerType.OTHER.value: "OTH",
}


async def next_container_code(session: AsyncSession, container_type: str) -> str:
    number = await session.scalar(text("SELECT nextval('container_code_number_seq')"))
    return f"{CONTAINER_CODE_PREFIXES[container_type]}-{number:06d}"


async def next_item_code(session: AsyncSession) -> str:
    number = await session.scalar(text("SELECT nextval('item_code_number_seq')"))
    return f"ITM-{number:06d}"
