from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


class Operations:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def get_bind(self):
        return self

    def rename_table(self, old: str, new: str) -> None:
        self.calls.append(("rename_table", old, new))

    def add_column(self, table: str, column) -> None:
        self.calls.append(("add_column", table, column.name, column.server_default.arg))

    def alter_column(self, table: str, column: str, **changes) -> None:
        self.calls.append(("alter_column", table, column, changes["new_column_name"]))

    def execute(self, statement: str) -> None:
        self.calls.append(("execute", statement))


def test_upgrade_renames_authoritative_scope_and_defaults_existing_rows(monkeypatch) -> None:
    path = Path(__file__).parents[1] / "alembic/versions/0013_workspace_model.py"
    spec = spec_from_file_location("workspace_migration", path)
    assert spec and spec.loader
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    operations = Operations()
    monkeypatch.setattr(migration, "op", operations)
    monkeypatch.setattr(migration.postgresql.ENUM, "create", lambda *args, **kwargs: None)

    migration.upgrade()

    assert ("rename_table", "households", "workspaces") in operations.calls
    assert ("rename_table", "household_users", "workspace_memberships") in operations.calls
    assert ("add_column", "workspaces", "workspace_type", "household") in operations.calls
    for table in migration.DIRECTLY_SCOPED_TABLES:
        assert ("alter_column", table, "household_id", "workspace_id") in operations.calls
    assert (
        "alter_column",
        "workspace_memberships",
        "relationship_type",
        "role",
    ) in operations.calls
