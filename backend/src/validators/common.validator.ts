import { z } from 'zod';

/** Mongo ObjectId as it arrives in a URL. */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

export const idParams = z.object({ id: objectId });

/** Query strings arrive as text, so numbers and booleans are coerced here. */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // 500 rather than 100: reference lists (stores, services, categories) are
  // loaded whole to fill pickers, and a silently-rejected request there shows
  // up as an empty dropdown rather than an error.
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().min(1).optional(),
  sort: z.string().trim().optional(),
});

export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export type PaginationQuery = z.infer<typeof paginationQuery>;

/**
 * A base64 data URL for an image.
 *
 * Images are stored inline in Mongo for now, so the cap matters: a document is
 * limited to 16MB, and oversized rows slow every query that touches them. The
 * client downscales before upload, so this ceiling should never be hit in
 * normal use — it is a backstop, not the expected size.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * An image: either an uploaded base64 data URL or a plain http(s) link.
 *
 * Written as one schema with explicit branches rather than a union of
 * `base64Image | z.string().url()`. A `data:` URL of ANY type is a valid URL,
 * so that union quietly accepted PDFs and oversized payloads through its
 * url() branch. Branching on the prefix keeps each rule enforced and lets the
 * error say what is actually wrong.
 *
 * The size cap matters because images are stored inline in Mongo: a document
 * is capped at 16MB, and large rows slow every query that touches them.
 */
export const imageInput = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value === '') return;

    if (value.startsWith('data:')) {
      if (!IMAGE_DATA_URL.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must be a PNG, JPEG, WebP or GIF image',
        });
        return;
      }
      if (value.length > MAX_IMAGE_BYTES) {
        ctx.addIssue({
          code: 'custom',
          message: `Image is too large (max ${Math.round(
            MAX_IMAGE_BYTES / 1024 / 1024,
          )}MB) — try a smaller screenshot`,
        });
      }
      return;
    }

    if (!/^https?:\/\/\S+$/i.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be an uploaded image or an http(s) link',
      });
    }
  });

/** Kept for callers that only ever accept an upload. */
export const base64Image = imageInput;
