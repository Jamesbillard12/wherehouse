import { describe, expect, it, vi } from 'vitest'

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn() }))

import { migrateLegacyWorkspaceColumns } from './database'

describe('workspace-scoped offline migration', () => {
  it('renames every legacy household scope without changing cached records', async () => {
    const getAllAsync = vi
      .fn()
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([{ name: 'household_id' }])
      .mockResolvedValueOnce([
        { name: 'workspace_id', pk: 1 },
        { name: 'entity_type', pk: 2 },
        { name: 'entity_id', pk: 3 },
      ])
    const execAsync = vi.fn().mockResolvedValue(undefined)

    await migrateLegacyWorkspaceColumns({ getAllAsync, execAsync } as never)

    expect(execAsync).toHaveBeenCalledTimes(6)
    for (const call of execAsync.mock.calls) {
      expect(call[0]).toMatch(
        /^ALTER TABLE [a-z_]+ RENAME COLUMN household_id TO workspace_id$/,
      )
    }
  })
})
