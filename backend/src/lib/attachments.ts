import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// backend/dist/lib -> repo root
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR
  ? path.resolve(process.env.ATTACHMENTS_DIR)
  : path.join(REPO_ROOT, "data", "attachments");

export const MAX_ATTACHMENT_BYTES = (Number(process.env.ATTACHMENTS_MAX_MB) || 10) * 1024 * 1024;

// Evidence is documents and screenshots — not archives or executables.
export const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const ATTACHMENT_ENTITIES = [
  "RISK",
  "CONTROL",
  "MODEL_CARD",
  "AI_SYSTEM",
  "PROJECT",
] as const;
export type AttachmentEntity = (typeof ATTACHMENT_ENTITIES)[number];

export function ensureAttachmentsDir(): void {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

/** A random on-disk name; the user-facing name is kept in the DB row. */
export function newStorageKey(originalName: string): string {
  const ext = path
    .extname(originalName)
    .slice(0, 12)
    .replace(/[^A-Za-z0-9.]/g, "");
  return `${crypto.randomBytes(16).toString("hex")}${ext}`;
}

export function storagePath(storageKey: string): string {
  // Defend against traversal — storageKey is ours, but be certain.
  const resolved = path.resolve(ATTACHMENTS_DIR, path.basename(storageKey));
  if (path.dirname(resolved) !== ATTACHMENTS_DIR) {
    throw new Error("invalid storage key");
  }
  return resolved;
}

export function writeAttachment(storageKey: string, data: Buffer): void {
  ensureAttachmentsDir();
  fs.writeFileSync(storagePath(storageKey), data);
}

export function deleteAttachment(storageKey: string): void {
  try {
    fs.unlinkSync(storagePath(storageKey));
  } catch {
    // already gone — fine.
  }
}

/** A safe, human filename for the Content-Disposition header. */
export function safeDownloadName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 200) || "attachment";
}
