from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.core import ContainerRelationship, ContainerType, HouseholdRelationship
from app.schemas.core import (
    ContainerCreate,
    HouseholdUserCreate,
    ItemPlacementCreate,
)


def test_household_relationship_values_are_stable() -> None:
    payload = HouseholdUserCreate(user_id=uuid4(), relationship_type="owner")
    assert payload.relationship_type is HouseholdRelationship.OWNER


def test_container_type_values_are_stable() -> None:
    payload = ContainerCreate(
        area_id=uuid4(),
        name="Camping Bin",
        container_type="bin",
    )
    assert payload.container_type is ContainerType.BIN


def test_item_placement_requires_exactly_one_target() -> None:
    with pytest.raises(ValidationError):
        ItemPlacementCreate()

    with pytest.raises(ValidationError):
        ItemPlacementCreate(area_id=uuid4(), zone_id=uuid4())


def test_container_relationship_only_applies_to_container_target() -> None:
    with pytest.raises(ValidationError):
        ItemPlacementCreate(area_id=uuid4(), relationship_type=ContainerRelationship.IN)

    placement = ItemPlacementCreate(
        container_id=uuid4(),
        relationship_type=ContainerRelationship.IN,
    )
    assert placement.relationship_type is ContainerRelationship.IN
