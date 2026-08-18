import { Router } from 'express'
import { confirmTwoFactorSetup, disableTwoFactor, login, logout, logoutAllDevices, me, requestPasswordReset, resetPassword, startTwoFactorSetup, verifyTwoFactorLogin } from '../controllers/auth.controller.js'
import { registerGuestAccount } from '../controllers/guest.controller.js'
import { csrfToken } from '../middleware/csrf.js'
import { requireAuth } from '../middleware/auth.js'
import { loginRateLimiter, passwordResetRateLimiter, twoFactorRateLimiter } from '../middleware/rate-limit.js'
import { asyncHandler } from '../utils/async-handler.js'

export const authRouter = Router()
authRouter.get('/csrf', csrfToken)
authRouter.post('/login', loginRateLimiter, asyncHandler(login))
authRouter.post('/register-guest', loginRateLimiter, asyncHandler(registerGuestAccount))
authRouter.post('/verify-2fa', twoFactorRateLimiter, asyncHandler(verifyTwoFactorLogin))
authRouter.post('/forgot-password', passwordResetRateLimiter, asyncHandler(requestPasswordReset))
authRouter.post('/reset-password', passwordResetRateLimiter, asyncHandler(resetPassword))
authRouter.post('/logout', requireAuth, asyncHandler(logout))
authRouter.post('/logout-all-devices', requireAuth, asyncHandler(logoutAllDevices))
authRouter.post('/two-factor/setup', requireAuth, asyncHandler(startTwoFactorSetup))
authRouter.post('/two-factor/confirm', requireAuth, asyncHandler(confirmTwoFactorSetup))
authRouter.post('/two-factor/disable', requireAuth, asyncHandler(disableTwoFactor))
authRouter.get('/me', requireAuth, me)
