from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.auth import DeviceType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BorrowerCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)


class BorrowerUpdate(BorrowerCreate):
    pass


class BorrowerRead(ORMModel):
    id: UUID
    workspace_id: UUID
    display_name: str
    email: str | None
    linked_user_id: UUID | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def access_type(self) -> str:
        return "self_service" if self.linked_user_id else "managed"


class InvitationRead(BaseModel):
    id: UUID
    borrower_profile_id: UUID
    workspace_id: UUID
    workspace_name: str
    borrower_name: str
    invited_email: str
    expires_at: datetime
    invite_uri: str | None = None


class InvitationClaim(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=10, max_length=1024)
    display_name: str | None = Field(default=None, max_length=200)
    device_name: str = Field(min_length=1, max_length=200)
    device_type: DeviceType


class InvitationClaimResult(BaseModel):
    access_token: str
    token_type: str = "bearer"
    device_id: UUID
    user_id: UUID
    workspace_id: UUID
    borrower_profile_id: UUID
    base_url: str


class CheckoutCreate(BaseModel):
    item_id: UUID
    borrower_profile_id: UUID | None = None
    due_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)


class CheckoutReturn(BaseModel):
    notes: str | None = Field(default=None, max_length=4000)


class CheckoutRead(BaseModel):
    id: UUID
    workspace_id: UUID
    item_id: UUID
    item_name: str
    borrower_profile_id: UUID
    borrower_name: str
    borrower_access_type: str
    checked_out_at: datetime
    due_at: datetime | None
    returned_at: datetime | None
    checkout_notes: str | None
    return_notes: str | None
    checked_out_by_user_id: UUID
    returned_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime
    overdue: bool
