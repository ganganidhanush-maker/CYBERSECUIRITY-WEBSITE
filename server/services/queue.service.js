/**
 * Concurrency & Virtual Waiting Room Service
 *
 * Designed specifically for resource-constrained hosting (Render free tier / TiDB free tier)
 * to prevent 502 Bad Gateway and connection pool exhaustion when high volumes of students
 * arrive concurrently.
 *
 * Keeps simultaneous active students within a strict limit (default 3-5 users)
 * and holds surplus students in a sequential Virtual Waiting Room with custom countdown timers.
 */

// In-memory active student sessions: Map<userId, { admittedAt: number, lastHeartbeat: number }>
const activeSlots = new Map()

// In-memory waiting queue: Map<userId, { joinedAt: number, waitTimerSeconds: number }>
const waitingQueue = new Map()

const IDLE_TIMEOUT_MS = 60_000 // 60 seconds without activity frees the slot

function cleanupStaleSlots() {
  const now = Date.now()
  for (const [userId, slot] of activeSlots.entries()) {
    if (now - slot.lastHeartbeat > IDLE_TIMEOUT_MS) {
      activeSlots.delete(userId)
    }
  }
}

export function evaluateUserQueue(user, session, config = {}) {
  // Only students are subject to waiting room; leadership and admins always bypass
  if (!user || user.role !== 'STUDENT') {
    return {
      requiresQueue: false,
      activeCount: activeSlots.size,
      maxConcurrent: config.maxConcurrent || 5,
    }
  }

  const queueEnabled = config.queueEnabled !== false
  const maxConcurrent = Math.max(1, Number(config.maxConcurrent) || 5)
  const baseWaitSeconds = Math.max(5, Number(config.waitTimeSeconds) || 15)

  if (!queueEnabled) {
    return {
      requiresQueue: false,
      activeCount: activeSlots.size,
      maxConcurrent,
    }
  }

  cleanupStaleSlots()

  // 1. If user already has an active slot, refresh it
  if (activeSlots.has(user.id)) {
    const slot = activeSlots.get(user.id)
    slot.lastHeartbeat = Date.now()
    activeSlots.set(user.id, slot)
    waitingQueue.delete(user.id)
    return {
      requiresQueue: false,
      activeCount: activeSlots.size,
      maxConcurrent,
    }
  }

  // 2. If slots available, admit immediately
  if (activeSlots.size < maxConcurrent) {
    activeSlots.set(user.id, {
      admittedAt: Date.now(),
      lastHeartbeat: Date.now(),
    })
    waitingQueue.delete(user.id)
    return {
      requiresQueue: false,
      activeCount: activeSlots.size,
      maxConcurrent,
    }
  }

  // 3. Surplus students placed in queue
  if (!waitingQueue.has(user.id)) {
    waitingQueue.set(user.id, {
      joinedAt: Date.now(),
      waitTimerSeconds: baseWaitSeconds,
    })
  }

  // Calculate position in queue
  const queueKeys = Array.from(waitingQueue.keys())
  const positionIndex = queueKeys.indexOf(user.id)
  const position = positionIndex >= 0 ? positionIndex + 1 : 1

  // Wait time scaled by position (e.g. #1 waits baseWait, #2 waits baseWait * 1.5, etc.)
  const queueWaitSeconds = Math.max(5, Math.min(120, Math.round(baseWaitSeconds * (1 + (position - 1) * 0.5))))

  return {
    requiresQueue: true,
    queuePosition: position,
    queueWaitSeconds,
    activeCount: activeSlots.size,
    maxConcurrent,
  }
}

export function admitFromQueue(user) {
  if (!user) return
  cleanupStaleSlots()
  activeSlots.set(user.id, {
    admittedAt: Date.now(),
    lastHeartbeat: Date.now(),
  })
  waitingQueue.delete(user.id)
}

export function heartbeatSlot(user) {
  if (!user) return
  if (activeSlots.has(user.id)) {
    const slot = activeSlots.get(user.id)
    slot.lastHeartbeat = Date.now()
    activeSlots.set(user.id, slot)
  }
}

export function releaseSlot(userId) {
  if (userId) {
    activeSlots.delete(userId)
    waitingQueue.delete(userId)
  }
}

export function getQueueStats() {
  cleanupStaleSlots()
  return {
    activeSlotsCount: activeSlots.size,
    waitingCount: waitingQueue.size,
  }
}
