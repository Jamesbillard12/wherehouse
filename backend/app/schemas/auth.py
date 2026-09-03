from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.auth import DeviceType, InstanceType
from app.models.core import WorkspaceRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=1024)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime | None = None


class AuthUser(BaseModel):
    id: UUID
    email: str
    display_name: str


class WorkspaceAccess(BaseModel):
    workspace_id: UUID
    role: WorkspaceRole

    @computed_field
    @property
    def household_id(self) -> UUID:
        """Deprecated v1 compatibility alias."""
        return self.workspace_id

    @computed_field
    @property
    def relationship_type(self) -> WorkspaceRole:
        """Deprecated v1 compatibility alias."""
        return self.role


class MeResponse(BaseModel):
    user: AuthUser
    authenticated_by: str
    device_id: UUID | None = None
    workspaces: list[WorkspaceAccess]

    @computed_field
    @property
    def households(self) -> list[WorkspaceAccess]:
        """Deprecated v1 compatibility collection."""
        return self.workspaces


class PairingSessionCreate(BaseModel):
    instance_name: str = Field(min_length=1, max_length=200)
    instance_type: InstanceType


class PairingSessionCreated(BaseModel):
    id: UUID
    token: str
    pairing_uri: str
    expires_at: datetime


class PairingConsume(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    device_name: str = Field(min_length=1, max_length=200)
    device_type: DeviceType


class PairingResult(AccessToken):
    device_id: UUID
    user_id: UUID
    workspace_id: UUID
    instance_id: UUID
    instance_name: str
    base_url: str

    @computed_field
    @property
    def household_id(self) -> UUID:
        """Deprecated v1 compatibility alias."""
        return self.workspace_id


class DeviceRead(ORMModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID
    name: str
    device_type: DeviceType
    last_seen_at: datetime | None
    is_active: bool
    created_at: datetime
    revoked_at: datetime | None

    @computed_field
    @property
    def household_id(self) -> UUID:
        """Deprecated v1 compatibility alias."""
        return self.workspace_id
