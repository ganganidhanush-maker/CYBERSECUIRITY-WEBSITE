import dns from 'node:dns'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { getCachedClubSetting } from './platform-role.service.js'

try {
  dns.setDefaultResultOrder('ipv4first')
} catch {
  // Ignore if unsupported in older runtime
}

function ipv4Lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback
  const opts = typeof options === 'object' && options !== null ? { ...options, family: 4 } : { family: 4 }
  return dns.lookup(hostname, opts, cb)
}

let transporter
let fallbackTransporter
export const testSentEmails = []

function formatFromAddress() {
  const raw = env.smtpFrom || env.smtpUser || 'cyberclubmrdu2025@gmail.com'
  if (raw.includes('<')) return raw
  return `"Cyber Security Club MRDU" <${raw}>`
}

function getTransporter() {
  if (!env.hasSmtp) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: Number(env.smtpPort) === 465,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
      family: 4,
      lookup: ipv4Lookup,
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      tls: {
        rejectUnauthorized: false,
        servername: env.smtpHost,
      },
    })
  }
  return transporter
}

function getFallbackTransporter() {
  if (!env.hasSmtp) return null
  if (!fallbackTransporter) {
    const altPort = Number(env.smtpPort) === 465 ? 587 : 465
    fallbackTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: altPort,
      secure: altPort === 465,
      requireTLS: altPort === 587,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
      family: 4,
      lookup: ipv4Lookup,
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      tls: {
        rejectUnauthorized: false,
        servername: env.smtpHost,
      },
    })
  }
  return fallbackTransporter
}

async function dispatchViaHttpsRelay(relayUrl, mailOptions) {
  const cleanUrl = String(relayUrl || '').trim()
  if (!cleanUrl || !cleanUrl.startsWith('https://')) {
    return null
  }

  let qrBase64 = null
  if (Array.isArray(mailOptions.attachments) && mailOptions.attachments[0]?.content) {
    const buf = mailOptions.attachments[0].content
    qrBase64 = Buffer.isBuffer(buf) ? buf.toString('base64') : String(buf)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text || '',
        html: mailOptions.html || '',
        from: env.smtpUser || 'cyberclubmrdu2025@gmail.com',
        senderName: 'Cyber Security Club MRDU',
        qrBase64,
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) {
      throw new Error(`HTTPS Gmail Relay returned HTTP ${res.status}`)
    }
    const data = await res.json().catch(() => ({ ok: true }))
    if (data && data.ok === false) {
      throw new Error(data.error || 'HTTPS Gmail Relay rejected the request.')
    }
    return { messageId: data?.messageId || `relay-${Date.now()}`, accepted: [mailOptions.to], via: 'HTTPS_RELAY' }
  } finally {
    clearTimeout(timeout)
  }
}

async function dispatchMailWithFallback(mailOptions) {
  if ((env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') && process.env.FORCE_LIVE_SMTP !== 'true') {
    testSentEmails.push({ ...mailOptions, sentAt: new Date().toISOString() })
    return { delivered: true, messageId: `test-${Date.now()}`, accepted: [mailOptions.to] }
  }

  // 1. Check if an HTTPS Port-443 Gmail Relay URL is configured (bypasses Render Free Tier port 465/587 block)
  const configuredRelayUrl = process.env.GMAIL_RELAY_URL || (await getCachedClubSetting('gmailRelayUrl', ''))
  if (configuredRelayUrl && String(configuredRelayUrl).trim().startsWith('https://')) {
    try {
      const relayResult = await dispatchViaHttpsRelay(configuredRelayUrl, mailOptions)
      if (relayResult) return { delivered: true, ...relayResult }
    } catch (relayErr) {
      console.warn('[MAIL WARN] HTTPS Relay attempt failed, trying direct IPv4 SMTP:', relayErr.message)
    }
  }

  const primary = getTransporter()
  if (!primary) {
    throw new Error('SMTP mail service is not configured on this server.')
  }

  try {
    const info = await primary.sendMail(mailOptions)
    return { delivered: true, ...info }
  } catch (primaryErr) {
    const secondary = getFallbackTransporter()
    if (!secondary) throw primaryErr
    try {
      const info = await secondary.sendMail(mailOptions)
      return { delivered: true, ...info }
    } catch (secondaryErr) {
      const code = secondaryErr?.code || primaryErr?.code || ''
      const msg = secondaryErr?.message || primaryErr?.message || ''
      if (['ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED', 'ESOCKET'].includes(code) || /ETIMEDOUT|ENETUNREACH|timeout/i.test(msg)) {
        throw new Error(
          `Render Free Tier blocked outbound SMTP ports 465/587 (${code || 'TIMEOUT'}). Click "Activate Free HTTPS Gmail Bridge" above (takes 30 seconds) or click "Open in Gmail" on the row to send via Port 443!`
        )
      }
      throw primaryErr
    }
  }
}

export async function verifyMailConfiguration() {
  if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') return
  const activeTransporter = getTransporter()
  if (!activeTransporter) return
  try {
    await activeTransporter.verify()
    console.info(`[MAIL INFO] SMTP ready for ${env.smtpUser}`)
  } catch (error) {
    console.warn(`[MAIL WARN] Initial SMTP verification warning (${env.smtpHost}:${env.smtpPort}): ${error.message}`)
  }
}

export async function sendPasswordResetEmail({ recipient, memberId, token }) {
  const activeTransporter = getTransporter()
  if (!activeTransporter || !env.publicAppUrl) return false
  const resetUrl = new URL('/reset-password', env.publicAppUrl)
  resetUrl.searchParams.set('token', token)
  await dispatchMailWithFallback({
    from: formatFromAddress(),
    to: recipient,
    subject: 'Reset your Cyber Security Club MRDU password',
    text: `A password reset was requested for Member ID ${memberId}. This link expires in 15 minutes: ${resetUrl.toString()}`,
  })
  return true
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function interpolatePassMessage(template, context) {
  const base = String(template || '').trim()
  if (!base) {
    return `Congratulations ${context.studentName}! Your official pass for ${context.eventTitle} has been issued and verified. Please present your QR pass at the event venue gate.`
  }
  return base
    .replace(/\{name\}/gi, context.studentName || 'Student')
    .replace(/\{rollNumber\}/gi, context.rollNumber || context.memberId || '')
    .replace(/\{memberId\}/gi, context.memberId || context.rollNumber || '')
    .replace(/\{event\}/gi, context.eventTitle || 'Event')
    .replace(/\{venue\}/gi, context.venue || 'MRDU Campus')
    .replace(/\{date\}/gi, context.eventDateFormatted || 'Upcoming')
    .replace(/\{passId\}/gi, context.passId || '')
}

export async function sendEventPassEmail({
  recipient,
  to,
  studentName,
  rollNumber,
  memberId,
  eventTitle,
  eventType,
  eventDate,
  venue,
  eventVenue,
  passId,
  qrCodeData,
  qrCodeDataUrl,
  customMessage,
}) {
  const resolvedRecipient = recipient || to
  const rawQrData = qrCodeData || qrCodeDataUrl
  const eventDateFormatted = eventDate
    ? new Date(eventDate).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'To Be Announced'

  const resolvedName = studentName || rollNumber || memberId || 'Student'
  const resolvedRoll = rollNumber || memberId || 'N/A'
  const resolvedVenue = venue || eventVenue || 'MRDU Campus Venue'

  const finalCustomMessage = interpolatePassMessage(customMessage, {
    studentName: resolvedName,
    rollNumber: resolvedRoll,
    memberId: memberId || resolvedRoll,
    eventTitle: eventTitle || 'Club Event',
    venue: resolvedVenue,
    eventDateFormatted,
    passId: passId || '',
  })

  const attachments = []
  let hasInlineQr = false
  if (rawQrData && typeof rawQrData === 'string' && rawQrData.startsWith('data:image/')) {
    const base64Data = rawQrData.split(',')[1]
    if (base64Data) {
      attachments.push({
        filename: `event-pass-${String(resolvedRoll).replace(/[^a-zA-Z0-9_-]/g, '')}.png`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: 'image/png',
        cid: 'eventpassqr@cyberclubmrdu',
      })
      hasInlineQr = true
    }
  }

  const portalUrl = env.publicAppUrl || ''
  const htmlCustomMessage = escapeHtml(finalCustomMessage).replace(/\r?\n/g, '<br />')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#071324;font-family:'Segoe UI',Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background-color:#0d1f38;border:1px solid #1e3a5f;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.45);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0284c7,#0f172a);padding:22px 24px;border-bottom:1px solid #1e3a5f;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#7dd3fc;text-transform:uppercase;">
          CYBER SECURITY CLUB · MRDU
        </div>
        <h1 style="margin:6px 0 8px;font-size:22px;color:#ffffff;font-weight:800;">
          ${escapeHtml(eventTitle || 'Official Event Pass')}
        </h1>
        <span style="display:inline-block;background-color:rgba(16,185,129,0.2);border:1px solid #10b981;color:#6ee7b7;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.5px;">
          ✅ PASS ISSUED &amp; VERIFIED
        </span>
      </div>

      <!-- Content -->
      <div style="padding:24px;">
        <p style="margin:0 0 14px;font-size:15px;color:#e2e8f0;">
          Hello <strong style="color:#ffffff;">${escapeHtml(resolvedName)}</strong> (<span style="font-family:monospace;color:#38bdf8;">${escapeHtml(resolvedRoll)}</span>),
        </p>

        <!-- Custom Message Box -->
        <div style="background-color:#112846;border-left:4px solid #38bdf8;border-radius:8px;padding:16px;margin:0 0 20px;color:#f8fafc;font-size:14px;line-height:1.6;">
          ${htmlCustomMessage}
        </div>

        <!-- Pass Details Table -->
        <div style="background-color:#09172a;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
            OFFICIAL ADMISSION PASS DETAILS
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;width:40%;">Attendee Name:</td>
              <td style="padding:6px 0;color:#ffffff;font-weight:700;">${escapeHtml(resolvedName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Roll No / Member ID:</td>
              <td style="padding:6px 0;color:#38bdf8;font-family:monospace;font-weight:700;">${escapeHtml(resolvedRoll)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Event:</td>
              <td style="padding:6px 0;color:#ffffff;font-weight:600;">${escapeHtml(eventTitle)} ${eventType ? `(${escapeHtml(eventType)})` : ''}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Date &amp; Time:</td>
              <td style="padding:6px 0;color:#e2e8f0;">${escapeHtml(eventDateFormatted)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Venue:</td>
              <td style="padding:6px 0;color:#e2e8f0;">${escapeHtml(resolvedVenue)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Pass ID:</td>
              <td style="padding:6px 0;color:#6ee7b7;font-family:monospace;font-size:12px;">${escapeHtml(passId)}</td>
            </tr>
          </table>
        </div>

        ${hasInlineQr ? `
        <!-- QR Code Box -->
        <div style="text-align:center;background-color:#ffffff;border-radius:12px;padding:20px;margin:0 auto 20px;max-width:240px;">
          <img src="${rawQrData && rawQrData.startsWith('data:image/') ? rawQrData : 'cid:eventpassqr@cyberclubmrdu'}" alt="Event Admission QR Pass" style="width:190px;height:190px;display:block;margin:0 auto;" />
          <div style="margin-top:8px;font-size:11px;font-weight:700;color:#0f172a;letter-spacing:0.5px;">
            SCAN AT VENUE ENTRANCE GATE
          </div>
        </div>
        ` : ''}

        <p style="margin:0 0 12px;font-size:12.5px;color:#94a3b8;line-height:1.5;text-align:center;">
          Your active pass is also available anytime inside your student account on the Cyber Security Club MRDU portal${portalUrl ? ` (<a href="${escapeHtml(portalUrl)}" style="color:#38bdf8;text-decoration:none;">${escapeHtml(portalUrl)}</a>)` : ''}.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color:#06101e;padding:14px 24px;border-top:1px solid #1e3a5f;text-align:center;font-size:11px;color:#64748b;">
        Malla Reddy (MR) Deemed to be University · Cyber Security Club (${escapeHtml(env.smtpUser || 'cyberclubmrdu2025@gmail.com')})
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = [
    `CYBER SECURITY CLUB MRDU - OFFICIAL EVENT PASS`,
    `Event: ${eventTitle}`,
    `Status: ISSUED & VERIFIED`,
    ``,
    `Hello ${resolvedName} (${resolvedRoll}),`,
    ``,
    finalCustomMessage,
    ``,
    `--- PASS DETAILS ---`,
    `Attendee: ${resolvedName}`,
    `Roll Number / ID: ${resolvedRoll}`,
    `Event: ${eventTitle}`,
    `Date & Time: ${eventDateFormatted}`,
    `Venue: ${resolvedVenue}`,
    `Pass ID: ${passId}`,
    ``,
    `Please present your attached QR code pass at the venue entrance gate.`,
  ].join('\n')

  return await dispatchMailWithFallback({
    from: formatFromAddress(),
    replyTo: env.smtpUser || 'cyberclubmrdu2025@gmail.com',
    to: resolvedRecipient,
    subject: `Official Event Pass: ${eventTitle} - ${resolvedName} (${resolvedRoll})`,
    text,
    html,
    attachments,
  })
}

