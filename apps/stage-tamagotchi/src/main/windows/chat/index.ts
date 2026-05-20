import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'
import type { McpStdioManager } from '../../services/airi/mcp-servers'
import type { WidgetsWindowManager } from '../widgets'

import { join, resolve } from 'node:path'

import { BrowserWindow, shell } from 'electron'

import icon from '../../../../resources/icon.png?asset'

import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { createReusableWindow } from '../../libs/electron/window-manager'
import { setupChatWindowElectronInvokes } from './rpc/index.electron'

export function setupChatWindowReusableFunc(params: {
  widgetsManager: WidgetsWindowManager
  serverChannel: ServerChannel
  mcpStdioManager: McpStdioManager
  i18n: I18n
}) {
  return createReusableWindow(async () => {
    const window = new BrowserWindow({
      title: 'AIRI - Chat Window',
      width: 600.0,
      height: 800.0,
      show: false,
      icon,
      webPreferences: {
        preload: join(getElectronMainDirname(), '../preload/index.cjs'),
        sandbox: true,
      },
    })

    window.on('ready-to-show', () => {
      console.log('[Main Process] [Chat Window] Event: "ready-to-show" triggered. Displaying window...')
      window.show()
    })
    window.on('show', () => {
      console.log('[Main Process] [Chat Window] Event: "show" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> true to main window webContents')
        mainWin.webContents.send('chat-window-state', true)
      }
    })
    window.on('hide', () => {
      console.log('[Main Process] [Chat Window] Event: "hide" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })
    window.on('closed', () => {
      console.log('[Main Process] [Chat Window] Event: "closed" triggered.')
      const allWins = BrowserWindow.getAllWindows()
      const mainWin = allWins.find(w => (w as any).__is_main_window === true)
      console.log(`[Main Process] [Chat Window] Searching for main window. Total windows: ${allWins.length}, Main window found: ${!!mainWin}`)
      if (mainWin && !mainWin.isDestroyed()) {
        console.log('[Main Process] [Chat Window] Sending "chat-window-state" -> false to main window webContents')
        mainWin.webContents.send('chat-window-state', false)
      }
    })
    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer')), '/chat'))

    await setupChatWindowElectronInvokes({
      window,
      widgetsManager: params.widgetsManager,
      serverChannel: params.serverChannel,
      mcpStdioManager: params.mcpStdioManager,
      i18n: params.i18n,
    })

    return window
  }).getWindow
}
