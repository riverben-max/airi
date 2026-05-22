import type { Rectangle } from 'electron'
import type { InferOutput } from 'valibot'

import type { globalAppConfigSchema } from '../../configs/global'
import type { Config } from '../../libs/electron/persistence'
import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { McpStdioManager } from '../../services/airi/mcp-servers'
import type { AutoUpdater } from '../../services/electron/auto-updater'
import type { NoticeWindowManager } from '../notice'
import type { OnboardingWindowManager } from '../onboarding'
import type { SettingsWindowManager } from '../settings'
import type { WidgetsWindowManager } from '../widgets'

import { dirname, resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

import { is } from '@electron-toolkit/utils'
import { defu } from 'defu'
import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { debounce, throttle } from 'es-toolkit'

import icon from '../../../../resources/icon.png?asset'

import { baseUrl, load } from '../../libs/electron/location'
import { transparentWindowConfig } from '../shared'
import { setupMainWindowElectronInvokes } from './rpc/index.electron'

export async function setupMainWindow(params: {
  settingsWindow: SettingsWindowManager
  chatWindow: () => Promise<BrowserWindow>
  widgetsManager: WidgetsWindowManager
  noticeWindow: NoticeWindowManager
  autoUpdater: AutoUpdater
  onWindowCreated?: (window: BrowserWindow) => void
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
  onboardingWindowManager: OnboardingWindowManager
  appConfig: Config<typeof globalAppConfigSchema>
}) {
  const getConfig = (): InferOutput<typeof globalAppConfigSchema> => params.appConfig.get() ?? { language: 'en', windows: [], microphoneToggleHotkey: 'Scroll' }
  const updateConfig = (newData: InferOutput<typeof globalAppConfigSchema>) => params.appConfig.update(newData)

  const mainWindowConfig = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')

  const window = new BrowserWindow({
    title: 'AIRI',
    width: mainWindowConfig?.width ?? mainWindowConfig?.snapshot?.width ?? 450.0,
    height: mainWindowConfig?.height ?? mainWindowConfig?.snapshot?.height ?? 600.0,
    x: mainWindowConfig?.x ?? mainWindowConfig?.snapshot?.x,
    y: mainWindowConfig?.y ?? mainWindowConfig?.snapshot?.y,
    show: false,
    icon,
    webPreferences: {
      preload: resolve(dirname(fileURLToPath(import.meta.url)), '../preload/index.cjs'),
      sandbox: true,
    },
    type: 'panel',
    alwaysOnTop: true,
    ...transparentWindowConfig(),
  })

  // Attach config for RPC sync
  ;(window as any).__airi_config = mainWindowConfig
  ;(window as any).__is_main_window = true

  window.setMovable(!mainWindowConfig?.locked)
  window.setResizable(!mainWindowConfig?.locked)

  if (params.onWindowCreated) {
    params.onWindowCreated(window)
  }

  ipcMain.on('main-window-config-updated', (_event, config) => {
    window.webContents.send('eventa:event:electron:windows:main:config-changed', config)
  })

  if (is.dev || env.MAIN_APP_DEBUG || env.APP_DEBUG) {
    try {
      window.webContents.openDevTools({ mode: 'detach' })
    }
    catch {}
  }

  function restoreBounds() {
    const mainWindow = getConfig().windows?.find((w: any) => w.title === 'AIRI' && w.tag === 'main')
    const x = mainWindow?.x ?? mainWindow?.snapshot?.x
    const y = mainWindow?.y ?? mainWindow?.snapshot?.y
    const width = mainWindow?.width ?? mainWindow?.snapshot?.width ?? 450.0
    const height = mainWindow?.height ?? mainWindow?.snapshot?.height ?? 600.0
    if (x !== undefined && y !== undefined) {
      window.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      })
    }
  }

  window.on('ready-to-show', () => {
    restoreBounds()
    window.show()
    // NOTICE: on some platforms/transparency settings, first bounds application might be ignored
    setTimeout(() => restoreBounds(), 500)
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  load(window, baseUrl(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer')))

  await setupMainWindowElectronInvokes({
    window,
    settingsWindow: params.settingsWindow,
    chatWindow: params.chatWindow,
    widgetsManager: params.widgetsManager,
    noticeWindow: params.noticeWindow,
    autoUpdater: params.autoUpdater,
    serverChannel: params.serverChannel,
    mcpStdioManager: params.mcpStdioManager,
    i18n: params.i18n,
    onboardingWindowManager: params.onboardingWindowManager,
  })

  function handleNewBounds(newBounds: Rectangle) {
    if (window.isDestroyed())
      return

    const config = getConfig()
    if (!config.windows || !Array.isArray(config.windows)) {
      config.windows = []
    }

    const existingConfigIndex = config.windows.findIndex((w: any) => w.title === 'AIRI' && w.tag === 'main')
    const existingConfig = existingConfigIndex !== -1 ? config.windows[existingConfigIndex] : null

    if (existingConfig?.locked) {
      return
    }

    if (existingConfigIndex === -1) {
      config.windows.push({
        title: 'AIRI',
        tag: 'main',
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height,
      })
    }
    else {
      const currentConfig = config.windows[existingConfigIndex]
      config.windows[existingConfigIndex] = defu({
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height,
      }, currentConfig)
    }

    updateConfig(config)
    window.webContents.send('eventa:event:electron:windows:main:config-changed', config.windows.find((w: any) => w.title === 'AIRI' && w.tag === 'main'))
  }

  const throttledHandleNewBounds = throttle(handleNewBounds, 200)

  const debouncedSnap = debounce(() => {
    if (window.isDestroyed())
      return

    const bounds = window.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    const displayBounds = display.bounds

    const isVertical = bounds.height > bounds.width
    const isHorizontal = bounds.width > bounds.height

    const SNAP_THRESHOLD = 25
    let newX = bounds.x
    let newY = bounds.y
    let snapped = false

    const snapTargetsX = [
      workArea.x,
      workArea.x + workArea.width,
      displayBounds.x,
      displayBounds.x + displayBounds.width,
    ]
    const snapTargetsY = [
      workArea.y,
      displayBounds.y,
    ]

    if (isVertical) {
      // Check left edge snap
      let minDiffLeft = Infinity
      let targetLeft = bounds.x
      for (const tx of snapTargetsX) {
        const diff = Math.abs(bounds.x - tx)
        if (diff < minDiffLeft) {
          minDiffLeft = diff
          targetLeft = tx
        }
      }

      // Check right edge snap
      let minDiffRight = Infinity
      let targetRight = bounds.x
      for (const tx of snapTargetsX) {
        const diff = Math.abs((bounds.x + bounds.width) - tx)
        if (diff < minDiffRight) {
          minDiffRight = diff
          targetRight = tx - bounds.width
        }
      }

      if (minDiffLeft <= SNAP_THRESHOLD && minDiffLeft <= minDiffRight) {
        newX = targetLeft
        snapped = true
      }
      else if (minDiffRight <= SNAP_THRESHOLD) {
        newX = targetRight
        snapped = true
      }
    }
    else if (isHorizontal) {
      // Check top edge snap only
      let minDiffTop = Infinity
      let targetTop = bounds.y
      for (const ty of snapTargetsY) {
        const diff = Math.abs(bounds.y - ty)
        if (diff < minDiffTop) {
          minDiffTop = diff
          targetTop = ty
        }
      }

      if (minDiffTop <= SNAP_THRESHOLD) {
        newY = targetTop
        snapped = true
      }
    }

    if (snapped && (Math.round(newX) !== bounds.x || Math.round(newY) !== bounds.y)) {
      window.setBounds({
        x: Math.round(newX),
        y: Math.round(newY),
        width: bounds.width,
        height: bounds.height,
      })
    }
  }, 150)

  window.on('resize', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
    }
  })
  window.on('move', () => {
    if (!window.isDestroyed()) {
      throttledHandleNewBounds(window.getBounds())
      debouncedSnap()
    }
  })

  return window
}
