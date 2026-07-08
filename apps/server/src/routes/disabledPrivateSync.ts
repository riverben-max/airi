import type { Context } from 'hono'

import type { HonoEnv } from '../types/hono'

import { Hono } from 'hono'

export const PRIVATE_SYNC_DISABLED_ERROR = 'PRIVATE_SYNC_DISABLED'
export const PRIVATE_SYNC_DISABLED_STATUS = 410

const PRIVATE_SYNC_DISABLED_MESSAGE = 'Private chats, private character cards, and memory are stored locally on this device in this product build.'

/**
 * Returns the stable Phase 1 response for disabled private sync endpoints.
 *
 * The response is shared by REST and the retired chat WebSocket endpoint so
 * old clients fail explicitly instead of creating server-backed private data.
 */
export function createDisabledPrivateSyncResponse(c: Context<HonoEnv>) {
  return c.json({
    error: PRIVATE_SYNC_DISABLED_ERROR,
    message: PRIVATE_SYNC_DISABLED_MESSAGE,
  }, PRIVATE_SYNC_DISABLED_STATUS)
}

/**
 * Creates a catch-all router for server-backed private sync routes.
 */
export function createDisabledPrivateSyncRoutes() {
  return new Hono<HonoEnv>()
    .all('/', createDisabledPrivateSyncResponse)
    .all('*', createDisabledPrivateSyncResponse)
}
