import express from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { requireRole } from "../rbac.js";
import { badRequest, forbidden, notFound, unprocessable } from "../httpError.js";
import { audit } from "../lib/audit.js";
import { MAX_LIST_ROWS } from "../lib/http.js";
import {
  ALLOWED_CONTENT_TYPES,
  ATTACHMENT_ENTITIES,
  MAX_ATTACHMENT_BYTES,
  deleteAttachment,
  newStorageKey,
  safeDownloadName,
  storagePath,
  writeAttachment,
} from "../lib/attachments.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
});

const entitySchema = z.enum(ATTACHMENT_ENTITIES);

type EntityType = (typeof ATTACHMENT_ENTITIES)[number];

async function entityExists(entityType: EntityType, id: string): Promise<boolean> {
  const where = { where: { id } };
  switch (entityType) {
    case "RISK":
      return Boolean(await prisma.risk.findUnique(where));
    case "CONTROL":
      return Boolean(await prisma.control.findUnique(where));
    case "MODEL_CARD":
      return Boolean(await prisma.modelCard.findUnique(where));
    case "AI_SYSTEM":
      return Boolean(await prisma.aIAsset.findUnique(where));
    case "PROJECT":
      return Boolean(await prisma.project.findUnique(where));
  }
}

async function assertEntityExists(entityType: EntityType, entityId: string) {
  if (!(await entityExists(entityType, entityId))) throw notFound(`${entityType} not found`);
}

function toResponse(row: {
  id: string;
  entityType: string;
  entityId: string;
  filename: string;
  contentType: string;
  size: number;
  description: string | null;
  createdAt: Date;
  uploadedBy?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    description: row.description,
    createdAt: row.createdAt,
    uploadedBy: row.uploadedBy ?? null,
  };
}

router.get("/attachments", requireAuth, async (req, res, next) => {
  try {
    const entityType = entitySchema.parse(req.query.entityType);
    const entityId = z.string().min(1).parse(req.query.entityId);
    const rows = await prisma.attachment.findMany({
      where: { entityType, entityId },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_LIST_ROWS,
    });
    res.json({ attachments: rows.map(toResponse) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/attachments",
  requireAuth,
  requireRole("ADMIN", "RISK_OWNER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          entityType: entitySchema,
          entityId: z.string().min(1),
          description: z.string().max(500).optional(),
        })
        .parse(req.body);

      const file = req.file;
      if (!file) throw badRequest("A file is required (multipart field 'file')");
      if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
        throw unprocessable(`Unsupported file type: ${file.mimetype}`);
      }
      await assertEntityExists(body.entityType, body.entityId);

      const storageKey = newStorageKey(file.originalname);
      writeAttachment(storageKey, file.buffer);

      const row = await prisma.attachment.create({
        data: {
          entityType: body.entityType,
          entityId: body.entityId,
          filename: file.originalname.slice(0, 255),
          contentType: file.mimetype,
          size: file.size,
          storageKey,
          description: body.description,
          uploadedById: req.user!.id,
        },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });
      await audit(req.user!.id, "Attachment", row.id, "CREATE", undefined, {
        entityType: row.entityType,
        entityId: row.entityId,
        filename: row.filename,
      });
      res.status(201).json({ attachment: toResponse(row) });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/attachments/:id/download", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.attachment.findUnique({ where: { id: String(req.params.id) } });
    if (!row) throw notFound("Attachment not found");
    res.setHeader("Content-Type", row.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeDownloadName(row.filename)}"`,
    );
    res.sendFile(storagePath(row.storageKey), (err) => {
      if (err && !res.headersSent) next(notFound("Attachment file is missing"));
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/attachments/:id", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.attachment.findUnique({ where: { id: String(req.params.id) } });
    if (!row) throw notFound("Attachment not found");
    // Uploader or an ADMIN may remove it.
    if (req.user!.role !== "ADMIN" && row.uploadedById !== req.user!.id) {
      throw forbidden("Only the uploader or an admin can delete this attachment");
    }
    await prisma.attachment.delete({ where: { id: row.id } });
    deleteAttachment(row.storageKey);
    await audit(
      req.user!.id,
      "Attachment",
      row.id,
      "DELETE",
      { filename: row.filename },
      undefined,
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
