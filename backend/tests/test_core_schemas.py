from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models import Area, Container, Item, Workspace, WorkspaceMembership
from app.models.core import (
    ContainerRelationship,
    ContainerType,
    ItemIdentifierType,
    WorkspaceRole,
)
from app.schemas.core import (
    AreaUpdate,
    ContainerCreate,
    ItemCreate,
    ItemPlacementCreate,
    WorkspaceCreate,
    WorkspaceMembershipCreate,
)


def test_workspace_name_cannot_be_only_whitespace() -> None:
    with pytest.raises(ValidationError):
        WorkspaceCreate(name="   ")


def test_area_update_accepts_name_or_icon() -> None:
    assert AreaUpdate(name="Garage").model_dump(exclude_none=True) == {"name": "Garage"}
    assert AreaUpdate(icon="warehouse").model_dump(exclude_none=True) == {"icon": "warehouse"}
    assert AreaUpdate(description=None).model_fields_set == {"description"}


def test_workspace_relationship_values_are_stable() -> None:
    payload = WorkspaceMembershipCreate(user_id=uuid4(), relationship_type="owner")
    assert payload.role is WorkspaceRole.OWNER


def test_workspace_is_the_single_top_level_scope() -> None:
    assert Workspace.__tablename__ == "workspaces"
    assert WorkspaceMembership.__tablename__ == "workspace_memberships"
    assert "workspace_id" in Area.__table__.columns
    assert "workspace_id" in Item.__table__.columns
    assert "workspace_id" not in Container.__table__.columns


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


def test_item_physical_identifier_supports_none_qr_nfc_and_both() -> None:
    assert ItemCreate(name="Drill").identifier_type is ItemIdentifierType.NONE
    assert ItemCreate(name="Drill", identifier_type="both").identifier_type is ItemIdentifierType.BOTH
