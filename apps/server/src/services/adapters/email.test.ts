import { describe, expect, it, vi } from 'vitest'

import { createEmailService } from './email'

describe('createEmailService', () => {
  it('sends mail through SMTP when SMTP is configured without Resend', async () => {
    const sendMail = vi.fn(async () => undefined)

    const service = createEmailService({
      apiKey: '',
      fromEmail: 'noreply@example.test',
      fromName: 'Project AIRI',
      smtp: {
        host: 'smtp.example.test',
        port: 587,
        secure: false,
        user: 'smtp-user',
        password: 'smtp-password',
      },
      createSmtpTransport: (options) => {
        expect(options).toEqual({
          host: 'smtp.example.test',
          port: 587,
          secure: false,
          auth: {
            user: 'smtp-user',
            pass: 'smtp-password',
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        })
        return { sendMail }
      },
    })

    await service.send({
      to: 'alice@example.test',
      subject: 'Verify your email',
      html: '<p>Hello</p>',
      text: 'Hello',
    })

    expect(sendMail).toHaveBeenCalledOnce()
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Project AIRI <noreply@example.test>',
      to: 'alice@example.test',
      subject: 'Verify your email',
      html: '<p>Hello</p>',
      text: 'Hello',
    })
  })
})
