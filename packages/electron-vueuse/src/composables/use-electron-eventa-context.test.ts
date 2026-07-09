import { describe, expect, it } from 'vitest'

import {
  resetElectronEventaContextForTesting,
  useElectronEventaInvoke,
} from './use-electron-eventa-context'

describe('useElectronEventaInvoke', () => {
  it('does not throw while creating an invoke without Electron IPC', async () => {
    resetElectronEventaContextForTesting()

    const invoke = useElectronEventaInvoke<unknown>({} as never)

    await expect(invoke()).rejects.toThrow('Electron ipcRenderer is not available')
  })
})
