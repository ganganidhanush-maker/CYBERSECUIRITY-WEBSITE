import crypto from 'node:crypto'
import { z } from 'zod'
import { normalizeImageUrl } from '../utils/image-url.js'

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

export const complaintSchema = z.object({
  subject: z.string().trim().min(2, 'Subject is required.').max(255),
  message: z.string().trim().min(5, 'Message must be at least 5 characters.').max(5000),
})

export const profileUpdateSchema = z.object({
  name: optionalText(120),
  rollNumber: optionalText(64),
  department: optionalText(120),
  year: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) && num >= 1 && num <= 8 ? num : null
  }),
  email: optionalEmail(),
  phone: optionalText(32),
  profileImage: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
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
  price: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    const num = Number(val || 0)
    return Number.isFinite(num) && num >= 0 ? num : 0
  }),
  capacity: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) && num > 0 ? num : null
  }),
  isAvailable: z.boolean().optional().default(true),
  instructions: optionalText(2000),
  sortOrder: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    const num = Number(val || 0)
    return Number.isFinite(num) ? num : 0
  }),
})

export const eventFormFieldInputSchema = z.object({
  id: z.string().optional(),
  fieldName: z.string().trim().min(1, 'Field name is required.').max(255),
  fieldType: z.string().trim().min(1).max(50),
  isRequired: z.boolean().optional().default(false),
  options: z.any().optional(),
})

export const eventInputSchema = z.object({
  title: z.string().trim().min(2, 'Event title is required.').max(255),
  shortDescription: optionalText(500),
  description: optionalText(5000),
  eventType: z.string().trim().min(1, 'Category / type is required.').max(100),
  dateTime: z.string().trim().min(1, 'Event date is required.').refine(value => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date and time.'),
  startTime: optionalText(50),
  endTime: optionalText(50),
  venue: optionalText(255),
  location: optionalText(255),
  capacity: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(value => {
    if (!value) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }),
  photoUrl: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  status: z.enum(['UPCOMING', 'OPEN', 'LIVE', 'CLOSED', 'COMPLETED', 'DRAFT']).optional().default('UPCOMING'),
  coordinatorName: optionalText(120),
  coordinatorContact: optionalText(120),
  organizingTeam: optionalText(255),
  speakerName: optionalText(120),
  speakerPhoto: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  speakerDesignation: optionalText(120),
  registrationDeadline: z.union([z.string(), z.null(), z.undefined()]).transform(val => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val) : null),
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
  paymentAmount: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(value => {
    if (!value) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }),
  paymentQrUrl: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  paymentUpiId: optionalText(120),
  paymentInstructions: optionalText(2000),
  paymentDeadline: z.union([z.string(), z.null(), z.undefined()]).transform(val => val && !Number.isNaN(new Date(val).getTime()) ? new Date(val) : null),
  requirePaymentProof: z.boolean().optional().default(false),
  allowMultipleActivities: z.boolean().optional().default(false),
  activities: z.array(eventActivityInputSchema).optional(),
  formFields: z.array(eventFormFieldInputSchema).optional(),
})

export const eventRegistrationSchema = z.object({
  selectedActivityIds: z.array(z.string()).optional(),
  paymentReference: optionalText(120),
  paymentProofUrl: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  branch: optionalText(120),
  section: optionalText(64),
  year: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
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
  name: z.string().trim().min(1, 'Album name is required.').max(120),
  description: optionalText(500),
  coverImage: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
})

export const galleryPhotoSchema = z.object({
  imageUrl: z.string().min(1, 'Photo image is required.').transform(value => normalizeImageUrl(value, { optional: false })),
  caption: optionalText(255),
})

export const galleryPhotosBatchSchema = z.object({
  photos: z.array(galleryPhotoSchema).min(1, 'At least one photo is required.'),
})

export const clubTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  roleTitle: z.string().trim().min(1, 'Role title is required.').max(120),
  photoUrl: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  bio: optionalText(500),
  collegeEmail: optionalEmail(),
  contactEmail: optionalEmail(),
  instagramUrl: optionalText(255),
  githubUrl: optionalText(255),
  linkedinUrl: optionalText(255),
  twitterUrl: optionalText(255),
  portfolioUrl: optionalText(255),
  skills: optionalText(500),
  year: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }),
  branch: optionalText(120),
  achievements: optionalText(5000),
  sortOrder: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
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
  siteStatus: z.enum(['ACTIVE', 'HIBERNATING']).optional(),
  hibernationStartedAt: optionalText(64),
  subscriptionEnabled: z.boolean().optional(),
  subscriptionMonthlyAmount: z.union([z.string(), z.number()]).optional(),
  subscriptionUpiId: optionalText(120),
  subscriptionQrUrl: z.union([z.string(), z.null(), z.undefined()]).transform(value => normalizeImageUrl(value)),
  introVideoEnabled: z.boolean().optional(),
  introVideoUrl: optionalText(5000),
  introVideoRequireTwoMinutes: z.boolean().optional(),
  onboardingBriefingMode: z.enum(['VIDEO', 'SLIDESHOW']).optional(),
  introBriefingMode: z.enum(['VIDEO', 'SLIDESHOW']).optional(),
  clubName: optionalText(120),
  contactEmail: optionalEmail(),
  contactPhone: optionalText(32),
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

export const guestRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(191),
  college: z.string().trim().min(2, 'College name is required.').max(120),
  branch: z.string().trim().min(2, 'Branch is required.').max(50),
  specialization: optionalText(50),
  phone: optionalText(32),
})

export const bulkStudentItemSchema = z.object({
  name: z.string().trim().min(1, 'Student name is required.').max(120),
  memberId: z.string().trim().min(4, 'Roll Number / Member ID must be at least 4 characters.').max(32),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  rollNumber: optionalText(64),
  department: optionalText(120),
  year: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform(val => {
    if (!val) return null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }),
  email: optionalEmail(),
  phone: optionalText(32),
})

export const bulkCreateMembersSchema = z.object({
  students: z.array(bulkStudentItemSchema).min(1, 'Please provide at least one student account.'),
})
