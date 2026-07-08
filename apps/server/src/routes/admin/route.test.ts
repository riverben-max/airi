import type { Database } from '../../libs/db'
import type { BillingService } from '../../services/domain/billing/billing-service'
import type { HonoEnv } from '../../types/hono'
import type { SQL } from 'drizzle-orm'

import { Hono } from 'hono'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import { createAdminRoutes } from '.'
import { ApiError } from '../../utils/error'

const ADMIN_USER = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@example.com',
  emailVerified: true,
  image: null,
  role: 'admin',
} as HonoEnv['Variables']['user']

function createUserRow() {
  return {
    id: 'user-1',
    name: 'Customer',
    email: 'customer@example.com',
    emailVerified: true,
    image: null,
    role: 'user',
    banned: true,
    banReason: 'Chargeback risk',
    banExpires: new Date('2026-07-20T00:00:00.000Z'),
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    updatedAt: new Date('2026-07-05T00:00:00.000Z'),
    flux: 42,
    stripeCustomerId: null,
  }
}

function createDb(row = createUserRow(), capturedWhere: Array<SQL | undefined> = []): Database {
  const select = vi.fn((selection: Record<string, unknown>) => {
    if (Object.prototype.hasOwnProperty.call(selection, 'count')) {
      return {
        from: () => ({
          where: async (condition: SQL | undefined) => {
            capturedWhere.push(condition)
            return [{ count: 1 }]
          },
        }),
      }
    }

    return {
      from: () => ({
        leftJoin: () => ({
          where: (condition: SQL | undefined) => {
            capturedWhere.push(condition)
            return {
              orderBy: () => ({
                limit: () => ({
                  offset: async () => [row],
                }),
              }),
              limit: async () => [row],
            }
          },
        }),
      }),
    }
  })

  return {
    select,
    query: {
      fluxTransaction: {
        findMany: vi.fn(async () => []),
      },
    },
  } as unknown as Database
}

function createTestApp(db: Database) {
  return new Hono<HonoEnv>()
    .use('*', async (c, next) => {
      c.set('user', ADMIN_USER)
      c.set('session', {} as HonoEnv['Variables']['session'])
      await next()
    })
    .route('/api/admin', createAdminRoutes({
      db,
      billingService: {} as BillingService,
      configKV: {},
    } as Parameters<typeof createAdminRoutes>[0]))
    .onError((err, c) => {
      if (err instanceof ApiError)
        return c.json({ error: err.errorCode, details: err.details }, err.statusCode)
      return c.json({ error: 'internal', message: (err as Error).message }, 500)
    })
}

describe('admin dashboard user routes', () => {
  it('includes role and ban metadata in the user list response', async () => {
    const app = createTestApp(createDb())

    const res = await app.request('/api/admin/users')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      users: [{
        id: 'user-1',
        role: 'user',
        banned: true,
        banReason: 'Chargeback risk',
        banExpires: '2026-07-20T00:00:00.000Z',
      }],
    })
  })

  it('includes role and ban metadata in the user detail response', async () => {
    const app = createTestApp(createDb())

    const res = await app.request('/api/admin/users/user-1')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      user: {
        id: 'user-1',
        role: 'user',
        banned: true,
        banReason: 'Chargeback risk',
        banExpires: '2026-07-20T00:00:00.000Z',
      },
    })
  })

  it('searches users by role on the backend result set', async () => {
    const capturedWhere: Array<SQL | undefined> = []
    const app = createTestApp(createDb(createUserRow(), capturedWhere))

    const res = await app.request('/api/admin/users?query=admin')

    expect(res.status).toBe(200)
    expect(capturedWhere[0]).toBeDefined()
    const compiledWhere = new PgDialect().sqlToQuery(capturedWhere[0]!)
    expect(compiledWhere.sql).toContain('"user"."role"')
    expect(compiledWhere.sql).toContain('regexp_split_to_array')
    expect(compiledWhere.params).toContain('admin')
  })
})
