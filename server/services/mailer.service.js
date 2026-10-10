import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

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
      connectionTimeout: 12000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
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
      auth: { user: env.smtpUser, pass: env.smtpPassword },
      connectionTimeout: 12000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  }
  return fallbackTransporter
}

async function dispatchMailWithFallback(mailOptions) {
  if (env.nodeEnv === 'test' && process.env.FORCE_LIVE_SMTP !== 'true') {
    testSentEmails.push({ ...mailOptions, sentAt: new Date().toISOString() })
    return { messageId: `test-${Date.now()}`, accepted: [mailOptions.to] }
  }

  const primary = getTransporter()
  if (!primary) {
    throw new Error('SMTP mail service is not configured on this server.')
  }

  try {
    return await primary.sendMail(mailOptions)
  } catch (primaryErr) {
    const secondary = getFallbackTransporter()
    if (!secondary) throw primaryErr
    try {
      return await secondary.sendMail(mailOptions)
    } catch {
      throw primaryErr
    }
  }
}

export async function verifyMailConfiguration() {
  if (env.nodeEnv === 'test') return
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
  studentName,
  rollNumber,
  memberId,
  eventTitle,
  eventType,
  eventDate,
  venue,
  passId,
  qrCodeData,
  customMessage,
}) {
  const eventDateFormatted = eventDate
    ? new Date(eventDate).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'To Be Announced'

  const resolvedName = studentName || rollNumber || memberId || 'Student'
  const resolvedRoll = rollNumber || memberId || 'N/A'
  const resolvedVenue = venue || 'MRDU Campus Venue'

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
  if (qrCodeData && typeof qrCodeData === 'string' && qrCodeData.startsWith('data:image/')) {
    const base64Data = qrCodeData.split(',')[1]
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
          <img src="cid:eventpassqr@cyberclubmrdu" alt="Event Admission QR Pass" style="width:190px;height:190px;display:block;margin:0 auto;" />
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
        Sent officially by Cyber Security Club MRDU (${escapeHtml(env.smtpUser || 'cyberclubmrdu2025@gmail.com')})
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
    to: recipient,
    subject: `🎟️ Event Pass Confirmed: ${eventTitle} (${resolvedRoll})`,
    text,
    html,
    attachments,
  })
}

