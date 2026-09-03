from dataclasses import dataclass, field
from uuid import UUID


@dataclass(frozen=True)
class ActorContext:
    """Framework-neutral identity and client context for application capabilities."""

    user_id: UUID
    client: str
    device_id: UUID | None = None
    workspace_id: UUID | None = None
    permissions: frozenset[str] = field(default_factory=frozenset)
    confirmed: bool = False
