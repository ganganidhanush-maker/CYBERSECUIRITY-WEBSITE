import { z } from 'zod'
import { memberPermissions } from '../config/permissions.js'

const optionalText = maxLength => z.union([z.string(), z.null(), z.undefined()]).transform(value => {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, maxLength)
  return null
})

const optionalEmail = () => z.union([
  z.string().trim().email('Enter a valid email address.').max(191),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform(val => (typeof val === 'string' && val.trim() ? val.trim() : null))

const memberId = z.string().trim()
  .min(3, 'User ID / Member ID must be at least 3 characters.')
  .max(64, 'User ID / Member ID must be 64 characters or fewer.')
  .regex(/^[A-Za-z0-9_.-]+$/, 'User ID / Member ID must contain only alphanumeric characters, dashes, dots, or underscores.')

const strongPassword = z.string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/\d/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special symbol (e.g. !@#$%).')

export const loginSchema = z.object({
  memberId,
  password: z.string().min(1, 'Password is required.').max(128),
})

export const passwordResetRequestSchema = z.object({ memberId })
export const passwordResetSchema = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/), password: strongPassword })
export const passwordConfirmationSchema = z.object({ password: z.string().min(1).max(128), code: z.string().trim().regex(/^\d{6}$/) })
export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) })
export const userIdParamSchema = z.object({ id: z.string().cuid() })

export const roleEnumSchema = z.enum([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'CONVENER',
  'CO_CONVENER',
  'FACULTY',
  'STUDENT_COORDINATOR',
  'TREASURER',
  'EVENT_MANAGEMENT',
  'MEDIA_LEAD',
  'SOCIAL_MEDIA_LEAD',
  'TECH_TEAM',
  'PR_TEAM',
  'CULTURAL',
  'SECRETARY',
  'ADMIN',
  'STUDENT',
])

export const accountStatusSchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'DISABLED']),
})

const memberPermissionSchema = z.enum(memberPermissions)

export const createMemberSchema = z.object({
  memberId,
  password: strongPassword,
  role: roleEnumSchema,
  profile: z.object({
    name: z.string().trim().min(1, 'Name is required.').max(120),
    rollNumber: optionalText(64),
    department: optionalText(120),
    year: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
      if (!val) return null
      const num = Number(val)
      return Number.isFinite(num) && num >= 1 && num <= 8 ? num : null
    }),
    email: optionalEmail(),
    phone: optionalText(32),
  }),
  permissions: z.array(memberPermissionSchema).optional().transform(perms => {
    return perms && perms.length ? perms : undefined
  }),
})

export const memberPermissionsSchema = z.object({
  permissions: z.array(memberPermissionSchema).max(memberPermissions.length).refine(values => new Set(values).size === values.length, 'Duplicate permissions are not allowed.'),
})

export const transferPresidentSchema = z.object({
  targetUserId: z.string().min(1, 'Select the new President.'),
  authenticationCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit authentication code.'),
})

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().optional(),
  password: z.string().optional(),
}).transform((data, ctx) => {
  const pwd = data.newPassword || data.password
  if (!pwd || typeof pwd !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password is required.' })
    return { newPassword: '' }
  }
  const result = strongPassword.safeParse(pwd)
  if (!result.success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error.issues[0]?.message || 'Provide a valid new password (12+ chars, upper, lower, number, symbol).' })
    return { newPassword: '' }
  }
  return { newPassword: result.data }
})
