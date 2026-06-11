import type { GoogleDriveService } from '../services/gdrive'
import type { HonoEnv } from '../types/hono'

import { Hono } from 'hono'

import { authGuard } from '../middlewares/auth'
import { createBadRequestError } from '../utils/error'

export function createGoogleDriveRoutes(gdriveService: GoogleDriveService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)

    /**
     * Reads the cloud configurations manifest from the user's AppData sandbox.
     */
    .get('/manifest', async (c) => {
      const user = c.get('user')!
      try {
        const manifest = await gdriveService.readManifest(user.id)
        return c.json(manifest)
      }
      catch (err: any) {
        console.error('[GDrive Route] Failed to read manifest:', err)
        return c.json({ error: err.message || 'Failed to download manifest' }, 500)
      }
    })

    /**
     * Saves or updates the cloud configurations manifest in the user's AppData sandbox.
     */
    .post('/manifest', async (c) => {
      const user = c.get('user')!
      try {
        const body = await c.req.json()
        if (!body || typeof body !== 'object') {
          throw createBadRequestError('Invalid manifest content')
        }

        await gdriveService.writeManifest(user.id, body)
        return c.json({ success: true })
      }
      catch (err: any) {
        console.error('[GDrive Route] Failed to save manifest:', err)
        return c.json({ error: err.message || 'Failed to save manifest' }, 500)
      }
    })
}
