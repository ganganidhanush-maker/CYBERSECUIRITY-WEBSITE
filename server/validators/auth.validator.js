import { z } from 'zod'
import { memberPermissions } from '../config/permissions.js'

const memberId = z.string().trim()
  .min(5, 'Member ID must be at least 5 characters.')
  .max(32, 'Member ID must be 32 characters or fewer.')
  .regex(/^[A-Za-z0-9]+$/, 'Member ID must contain only alphanumeric characters.')

const strongPassword = z.string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/\d/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special symbol (e.g. !@#$%).')

export const loginSchema = z.object({ memberId, password: z.string().min(1, 'Password is required.').max(128) })
export const passwordResetRequestSchema = z.object({ memberId })
export const passwordResetSchema = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/), password: strongPassword })
export const passwordConfirmationSchema = z.object({ password: z.string().min(1).max(128), code: z.string().trim().regex(/^\d{6}$/) })
export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) })
export const userIdParamSchema = z.object({ id: z.string().cuid() })

export const roleEnumSchema = z.enum([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'TREASURER',
  'EVENT_MANAGEMENT',
  'MEDIA_LEAD',
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

const optionalText = maxLength => z.string().trim().max(maxLength).optional().transform(value => value || null)

export const createMemberSchema = z.object({
  memberId,
  password: strongPassword,
  role: roleEnumSchema,
  profile: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    rollNumber: optionalText(64),
    department: optionalText(120),
    year: z.number().int().min(1).max(8).nullable().optional(),
    email: z.string().trim().email('Please enter a valid email address.').max(191).optional().or(z.literal('')).transform(value => value || null),
    phone: optionalText(32),
  }),
  permissions: z.array(memberPermissionSchema).optional().transform(perms => {
    // If not provided, will be auto-derived from role in controller
    return perms && perms.length ? perms : undefined
  }),
})

export const memberPermissionsSchema = z.object({
  permissions: z.array(memberPermissionSchema).min(1, 'Select at least one permission.').max(memberPermissions.length).refine(values => new Set(values).size === values.length, 'Duplicate permissions are not allowed.'),
})

export const transferPresidentSchema = z.object({
  targetUserId: z.string().min(1, 'Select the new President.'),
  authenticationCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit authentication code.'),
})

export const adminResetPasswordSchema = z.object({
  newPassword: strongPassword,
})
