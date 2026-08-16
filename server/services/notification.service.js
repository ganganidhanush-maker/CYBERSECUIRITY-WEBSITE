import { prisma } from '../db/prisma.js'

export async function createUserNotification({ userId, type, title, message, linkUrl }) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        linkUrl: linkUrl || null,
      },
    })
  } catch (err) {
    console.error('[NOTIFICATION ERROR]:', err.message)
    return null
  }
}

export async function createBroadcastNotification({ type, title, message, linkUrl }) {
  try {
    return await prisma.notification.create({
      data: {
        userId: null, // Broadcast to all
        type,
        title,
        message,
        linkUrl: linkUrl || null,
      },
    })
  } catch (err) {
    console.error('[BROADCAST NOTIFICATION ERROR]:', err.message)
    return null
  }
}
