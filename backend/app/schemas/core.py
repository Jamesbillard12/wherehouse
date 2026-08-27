from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.core import ContainerRelationship, ContainerType, HouseholdRelationship


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HouseholdCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class HouseholdRead(ORMModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=200)


class UserRead(ORMModel):
    id: UUID
    email: str
    display_name: str
    created_at: datetime
    updated_at: datetime


class HouseholdUserCreate(BaseModel):
    user_id: UUID
    relationship_type: HouseholdRelationship


class HouseholdUserRead(ORMModel):
    id: UUID
    household_id: UUID
    user_id: UUID
    relationship_type: HouseholdRelationship
    created_at: datetime
    updated_at: datetime


class AreaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class AreaRead(ORMModel):
    id: UUID
    household_id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ZoneRead(ORMModel):
    id: UUID
    area_id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ContainerCreate(BaseModel):
    area_id: UUID
    zone_id: UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=100)
    container_type: ContainerType
    description: str | None = None
    is_movable: bool = True
    is_out_of_space: bool = False


class ContainerRead(ORMModel):
    id: UUID
    area_id: UUID
    zone_id: UUID | None
    name: str
    code: str | None
    container_type: ContainerType
    description: str | None
    is_movable: bool
    is_out_of_space: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ContainerPlacementCreate(BaseModel):
    parent_container_id: UUID
    relationship_type: ContainerRelationship
    position: int | None = None


class ContainerPlacementRead(ORMModel):
    id: UUID
    container_id: UUID
    parent_container_id: UUID
    relationship_type: ContainerRelationship
    position: int | None
    created_at: datetime
    updated_at: datetime


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    quantity: Decimal = Field(default=Decimal(1), gt=0)
    unit: str | None = Field(default=None, max_length=50)
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    serial_number: str | None = Field(default=None, max_length=300)
    notes: str | None = None


class ItemRead(ORMModel):
    id: UUID
    household_id: UUID
    name: str
    description: str | None
    quantity: Decimal
    unit: str | None
    manufacturer: str | None
    model: str | None
    serial_number: str | None
    notes: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class ItemPlacementCreate(BaseModel):
    area_id: UUID | None = None
    zone_id: UUID | None = None
    container_id: UUID | None = None
    relationship_type: ContainerRelationship | None = None

    @model_validator(mode="after")
    def validate_single_target(self) -> "ItemPlacementCreate":
        target_count = sum(
            target is not None for target in (self.area_id, self.zone_id, self.container_id)
        )
        if target_count != 1:
            raise ValueError("exactly one of area_id, zone_id, or container_id is required")
        if self.container_id is None and self.relationship_type is not None:
            raise ValueError(
                "relationship_type is only valid when placing an item in/on a container"
            )
        return self


class ItemPlacementRead(ORMModel):
    id: UUID
    item_id: UUID
    area_id: UUID | None
    zone_id: UUID | None
    container_id: UUID | None
    relationship_type: ContainerRelationship | None
    created_at: datetime
    updated_at: datetime
