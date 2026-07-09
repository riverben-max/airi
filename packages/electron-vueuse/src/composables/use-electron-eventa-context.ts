import type { InvokeEventa, InvokeFunction } from '@moeru/eventa'
import type { ShallowRef } from 'vue'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { shallowRef } from 'vue'

type EventaContext = ReturnType<typeof createContext>['context']
type IpcRendererLike = Parameters<typeof createContext>[0]

let sharedContext: EventaContext | undefined

const ELECTRON_IPC_UNAVAILABLE_MESSAGE = 'Electron ipcRenderer is not available. Pass it explicitly to useElectronEventaContext().'

function getGlobalIpcRenderer(): IpcRendererLike | undefined {
  return (globalThis as { window?: { electron?: { ipcRenderer?: IpcRendererLike } } }).window?.electron?.ipcRenderer
}

function resolveIpcRenderer(ipcRenderer?: IpcRendererLike): IpcRendererLike {
  if (ipcRenderer) {
    return ipcRenderer
  }

  const globalIpcRenderer = getGlobalIpcRenderer()
  if (!globalIpcRenderer) {
    throw new Error(ELECTRON_IPC_UNAVAILABLE_MESSAGE)
  }

  return globalIpcRenderer
}

function createUnavailableElectronInvoke<Res, Req>(): InvokeFunction<Res, Req, EventaContext> {
  return (() => Promise.reject(new Error(ELECTRON_IPC_UNAVAILABLE_MESSAGE))) as InvokeFunction<Res, Req, EventaContext>
}

export function getElectronEventaContext(ipcRenderer?: IpcRendererLike): EventaContext {
  sharedContext ??= createContext(resolveIpcRenderer(ipcRenderer)).context
  return sharedContext
}

export function useElectronEventaContext(ipcRenderer?: IpcRendererLike): ShallowRef<EventaContext> {
  return shallowRef(getElectronEventaContext(ipcRenderer))
}

export function useElectronEventaInvoke<Res, Req = undefined, ResErr = Error, ReqErr = Error>(
  invoke: InvokeEventa<Res, Req, ResErr, ReqErr>,
  context?: EventaContext,
): InvokeFunction<Res, Req, EventaContext> {
  const resolvedContext = context ?? sharedContext ?? (getGlobalIpcRenderer() ? getElectronEventaContext() : undefined)

  if (!resolvedContext) {
    return createUnavailableElectronInvoke<Res, Req>()
  }

  return defineInvoke(resolvedContext, invoke)
}

export function resetElectronEventaContextForTesting() {
  sharedContext = undefined
}
