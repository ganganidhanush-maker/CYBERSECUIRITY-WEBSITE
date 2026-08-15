import crypto from 'node:crypto'
import { z } from 'zod'
import { normalizeImageUrl } from '../utils/image-url.js'

const optionalText = maxLength => z.string().trim().max(maxLength).optional().transform(value => value || null)
const optionalEmail = () => z.string().trim().email('Enter a valid email address.').max(191).optional().or(z.literal('')).transform(value => value || null)

export const complaintSchema = z.object({
  subject: z.string().trim().min(3).max(255),
  message: z.string().trim().min(10).max(5000),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  rollNumber: optionalText(64),
  department: optionalText(120),
  year: z.number().int().min(1).max(8).nullable().optional(),
  email: optionalEmail(),
  phone: optionalText(32),
  profileImage: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  bio: optionalText(500),
  instagramUrl: optionalText(255),
  githubUrl: optionalText(255),
  linkedinUrl: optionalText(255),
  portfolioUrl: optionalText(255),
  skills: optionalText(500),
  achievements: optionalText(5000),
})

export const eventActivityInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Activity name is required.').max(120),
  description: optionalText(500),
  price: z.union([z.string(), z.number()]).transform(val => {
    const num = Number(val || 0)
    return Number.isFinite(num) && num >= 0 ? num : 0
  }),
  capacity: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) && num > 0 ? num : null
  }),
  isAvailable: z.boolean().optional().default(true),
  instructions: optionalText(2000),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
})

export const eventFormFieldInputSchema = z.object({
  id: z.string().optional(),
  fieldName: z.string().trim().min(1, 'Field name is required.').max(255),
  fieldType: z.string().trim().min(1).max(50),
  isRequired: z.boolean().optional().default(false),
  options: z.any().optional(),
})

export const eventInputSchema = z.object({
  title: z.string().trim().min(3, 'Event title must be at least 3 characters.').max(255),
  shortDescription: optionalText(500),
  description: optionalText(5000),
  eventType: z.string().trim().min(2, 'Category / type is required.').max(100),
  dateTime: z.string().trim().min(1, 'Event date is required.').refine(value => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date and time.'),
  startTime: optionalText(50),
  endTime: optionalText(50),
  venue: optionalText(255),
  location: optionalText(255),
  capacity: z.union([z.string(), z.number()]).optional().nullable().transform(value => {
    if (value === undefined || value === null || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }),
  photoUrl: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  status: z.enum(['UPCOMING', 'OPEN', 'LIVE', 'CLOSED', 'COMPLETED', 'DRAFT']).optional().default('UPCOMING'),
  coordinatorName: optionalText(120),
  coordinatorContact: optionalText(120),
  organizingTeam: optionalText(255),
  speakerName: optionalText(120),
  speakerPhoto: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  speakerDesignation: optionalText(120),
  registrationDeadline: z.string().optional().nullable().transform(val => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val) : null),
  contactEmail: optionalEmail(),
  contactPhone: optionalText(32),
  socialLinks: z.any().optional(),
  rules: optionalText(10000),
  eligibility: optionalText(5000),
  requiredMaterials: optionalText(5000),
  agenda: optionalText(10000),
  faq: z.any().optional(),
  notes: optionalText(5000),
  requiresPayment: z.boolean().optional().default(false),
  paymentAmount: z.union([z.string(), z.number()]).optional().nullable().transform(value => {
    if (value === undefined || value === null || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }),
  paymentQrUrl: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  paymentUpiId: optionalText(120),
  paymentInstructions: optionalText(2000),
  paymentDeadline: z.string().optional().nullable().transform(val => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val) : null),
  requirePaymentProof: z.boolean().optional().default(false),
  allowMultipleActivities: z.boolean().optional().default(false),
  activities: z.array(eventActivityInputSchema).optional(),
  formFields: z.array(eventFormFieldInputSchema).optional(),
})

export const eventRegistrationSchema = z.object({
  selectedActivityIds: z.array(z.string()).optional(),
  paymentReference: optionalText(120),
  paymentProofUrl: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  branch: optionalText(120),
  section: optionalText(64),
  year: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }),
  emergencyContact: optionalText(32),
  teamName: optionalText(120),
  github: optionalText(120),
  formData: z.record(z.any()).optional(),
})

export const paymentVerificationSchema = z.object({
  paymentStatus: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'REFUNDED']),
  paymentNotes: optionalText(500),
})

export const galleryAlbumSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(500),
  coverImage: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
})

export const galleryPhotoSchema = z.object({
  imageUrl: z.string().transform(value => normalizeImageUrl(value, { optional: false })),
  caption: optionalText(255),
})

export const clubTeamMemberSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(120),
  roleTitle: z.string().trim().min(2, 'Role title is required.').max(120),
  photoUrl: z.string().optional().nullable().transform(value => normalizeImageUrl(value)),
  bio: optionalText(500),
  collegeEmail: optionalEmail(),
  contactEmail: optionalEmail(),
  instagramUrl: optionalText(255),
  githubUrl: optionalText(255),
  linkedinUrl: optionalText(255),
  twitterUrl: optionalText(255),
  portfolioUrl: optionalText(255),
  skills: optionalText(500),
  year: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }),
  branch: optionalText(120),
  achievements: optionalText(5000),
  sortOrder: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    const num = Number(val || 0)
    return Number.isFinite(num) ? num : 0
  }),
  isActive: z.boolean().optional().default(true),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED']).optional().default('APPROVED'),
})

export const deleteProtectedAccountSchema = z.object({
  authenticationCode: z.string().trim().regex(/^\d{6}$/, 'Enter the six-digit authentication code.'),
})

export const clubSettingsSchema = z.object({
  introVideoUrl: z.string().optional().nullable(),
  introVideoEnabled: z.boolean().optional().default(true),
  instagramUrl: optionalText(255),
  githubUrl: optionalText(255),
  linkedinUrl: optionalText(255),
  youtubeUrl: optionalText(255),
  twitterUrl: optionalText(255),
  discordUrl: optionalText(255),
  whatsappUrl: optionalText(255),
  websiteUrl: optionalText(255),
})

export function newId() {
  return crypto.randomUUID()
}
