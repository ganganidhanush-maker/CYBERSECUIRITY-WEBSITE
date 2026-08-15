import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transporter

function getTransporter() {
  if (!env.hasSmtp) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
    })
  }
  return transporter
}

export async function verifyMailConfiguration() {
  const activeTransporter = getTransporter()
  if (activeTransporter) await activeTransporter.verify()
}

export async function sendPasswordResetEmail({ recipient, memberId, token }) {
  const activeTransporter = getTransporter()
  if (!activeTransporter || !env.publicAppUrl) return false
  const resetUrl = new URL('/reset-password', env.publicAppUrl)
  resetUrl.searchParams.set('token', token)
  await activeTransporter.sendMail({
    from: env.smtpFrom,
    to: recipient,
    subject: 'Reset your Cyber Security Club MRDU password',
    text: `A password reset was requested for Member ID ${memberId}. This link expires in 15 minutes: ${resetUrl.toString()}`,
  })
  return true
}
