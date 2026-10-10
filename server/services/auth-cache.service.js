/**
 * Ultra-fast In-Memory Authentication Cache
 * Eliminates repeated remote TiDB Cloud round-trips for the same session.
 * Default TTL: 20 seconds.
 */
class AuthUserCache {
  constructor(ttlMs = 20_000) {
    this.ttlMs = ttlMs
    this.cache = new Map()
  }

  get(userId) {
    if (!userId) return null
    const entry = this.cache.get(userId)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId)
      return null
    }
    return entry.user
  }

  set(userId, user) {
    if (!userId || !user) return
    this.cache.set(userId, {
      user,
      expiresAt: Date.now() + this.ttlMs,
    })
    // Prevent unbounded memory growth
    if (this.cache.size > 2000) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
  }

  invalidate(userId) {
    if (!userId) return
    this.cache.delete(userId)
  }

  clear() {
    this.cache.clear()
  }
}

export const authUserCache = new AuthUserCache(60_000)
