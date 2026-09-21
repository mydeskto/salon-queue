import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../auth/middleware';
import { badRequest } from '../lib/errors';
import { asyncHandler } from '../lib/validate';

export const UPLOADS_DIR = resolve(__dirname, '../../uploads');

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOADS_DIR),
  filename: (_req, file, callback) => {
    // Random name — never trust the client-supplied filename for path safety.
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error('Only PNG, JPEG, or WEBP images are allowed'));
      return;
    }
    callback(null, true);
  },
});

export const uploadsRouter = Router();

/**
 * Image upload for salon branding (logo/photo). Scoped to salon_admin and
 * super_admin — the same roles allowed to edit a salon profile. Returns a
 * relative URL served by the static /uploads mount in app.ts.
 */
uploadsRouter.post(
  '/image',
  authenticate,
  requireRole('salon_admin', 'super_admin'),
  (req, res, next) => {
    upload.single('image')(req, res, (error: unknown) => {
      if (error) {
        next(badRequest(error instanceof Error ? error.message : 'Upload failed'));
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest('No image file provided (field name must be "image")');
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }),
);
