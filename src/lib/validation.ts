import { z } from 'zod';

/**
 * Shared schemas. Every one of these runs on the client for instant feedback
 * and again on the server, where it is the only version that counts.
 */

export const GENDER_VALUES = ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const;

const currentYear = new Date().getUTCFullYear();

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us what to call you.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(200, 'That is longer than we can store.'),
  // Optional demographics. The dashboards are built to report the coverage gap
  // rather than pretend it does not exist, so these stay genuinely optional.
  birthYear: z
    .union([z.literal(''), z.coerce.number().int().min(currentYear - 110).max(currentYear - 13)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  gender: z
    .union([z.literal(''), z.enum(GENDER_VALUES)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  country: z
    .union([z.literal(''), z.string().trim().length(2)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v!.toUpperCase())),
});

export type RegisterInput = z.input<typeof registerSchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.union([z.literal(''), z.string().max(400)]).optional(),
  birthYear: z
    .union([z.literal(''), z.coerce.number().int().min(currentYear - 110).max(currentYear - 13)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  gender: z
    .union([z.literal(''), z.enum(GENDER_VALUES)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  country: z
    .union([z.literal(''), z.string().trim().length(2)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v!.toUpperCase())),
  city: z
    .union([z.literal(''), z.string().trim().max(80)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

export const postSchema = z.object({
  title: z.string().trim().min(3, 'A headline is required.').max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only.')
    .max(90)
    .optional()
    .or(z.literal('')),
  excerpt: z.string().max(400).optional().or(z.literal('')),
  body: z.any(),
  coverImage: z.string().max(500).optional().or(z.literal('')),
  coverAlt: z.string().max(300).optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Choose a category.'),
  contentTypeId: z.string().min(1, 'Choose a content type.'),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  publishedAt: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isEditorPick: z.boolean().default(false),
  rating: z.union([z.literal(''), z.coerce.number().min(0).max(10)]).optional().nullable(),
  metaTitle: z.string().max(120).optional().or(z.literal('')),
  metaDescription: z.string().max(320).optional().or(z.literal('')),
  ogImage: z.string().max(500).optional().or(z.literal('')),
  tagIds: z.array(z.string()).default([]),
  newTags: z.array(z.string().trim().min(1).max(60)).default([]),
});

export type PostInput = z.infer<typeof postSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60).optional().or(z.literal('')),
  description: z.string().max(300).optional().or(z.literal('')),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #00E88F.'),
  parentId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(320),
  logo: z.string().max(500).optional().or(z.literal('')),
  social: z.record(z.string(), z.string().max(300)),
  homepageModules: z.array(z.string().max(60)),
  adSlots: z.object({
    betweenSections: z.boolean(),
    sidebar: z.boolean(),
    inArticle: z.boolean(),
  }),
  footerColumns: z.array(
    z.object({
      heading: z.string().max(60),
      links: z.array(z.object({ label: z.string().max(60), href: z.string().max(300) })),
    }),
  ),
});
