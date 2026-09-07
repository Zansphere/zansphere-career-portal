import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

// S3 Client configuration
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// ── POST /api/upload/resume ──────────────────────────────────
router.post(
  '/resume',
  authMiddleware,
  uploadLimiter,
  (req: AuthRequest, res: Response, next) => {
    upload.single('resume')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File size must be under 5MB.' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const sanitizedOriginalName = req.file.originalname.replace(/[\0\x00-\x1F\x7F]/g, '');
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(sanitizedOriginalName);
      const fileName = `resumes/resume-${uniqueSuffix}${ext}`;
      const bucketName = process.env.AWS_S3_BUCKET;

      if (!bucketName) {
        throw new Error('AWS_S3_BUCKET is not configured.');
      }

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(command);

      const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

      res.json({
        message: 'Resume uploaded successfully to S3!',
        fileUrl,
        fileName: sanitizedOriginalName,
      });
    } catch (err) {
      console.error('S3 Upload error:', err);
      res.status(500).json({ error: 'Failed to upload file.' });
    }
  }
);

export default router;
