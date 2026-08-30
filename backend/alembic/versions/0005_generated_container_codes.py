"""Generate type-prefixed container codes.

Revision ID: 0005_generated_codes
Revises: 0004_container_codes
"""

from alembic import op

revision = "0005_generated_codes"
down_revision = "0004_container_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE container_code_number_seq START WITH 1")
    op.execute(
        "WITH numbered AS ("
        "SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS code_number, "
        "CASE container_type::text "
        "WHEN 'bin' THEN 'BIN' WHEN 'box' THEN 'BOX' WHEN 'shelf' THEN 'SHF' "
        "WHEN 'shelving_unit' THEN 'SHU' WHEN 'cabinet' THEN 'CAB' "
        "WHEN 'drawer' THEN 'DRW' WHEN 'toolbox' THEN 'TLB' WHEN 'bag' THEN 'BAG' "
        "WHEN 'case' THEN 'CSE' WHEN 'rack' THEN 'RCK' WHEN 'hook' THEN 'HOK' "
        "WHEN 'workbench' THEN 'WRK' ELSE 'OTH' END AS prefix "
        "FROM containers"
        ") "
        "UPDATE containers AS container "
        "SET code = numbered.prefix || '-' || LPAD(numbered.code_number::text, 6, '0') "
        "FROM numbered WHERE container.id = numbered.id"
    )
    op.execute(
        "SELECT setval('container_code_number_seq', "
        "GREATEST((SELECT COUNT(*) FROM containers), 1), "
        "(SELECT COUNT(*) FROM containers) > 0)"
    )


def downgrade() -> None:
    op.execute("DROP SEQUENCE container_code_number_seq")
