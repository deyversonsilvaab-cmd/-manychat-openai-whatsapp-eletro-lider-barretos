import { clean } from "./utils.js";

export function pickAttachmentUrl(body = {}) {
  const keys = [
    "image_url", "imageUrl",
    "file_url", "fileUrl",
    "attachment_url", "attachmentUrl",
    "media_url", "mediaUrl",
    "document_url", "documentUrl",
    "pdf_url", "pdfUrl"
  ];

  for (const key of keys) {
    const value = clean(body[key]);
    if (value && /^https?:\/\//i.test(value)) return value;
  }

  return "";
}

export function detectFileType(url = "") {
  const lower = String(url).toLowerCase().split("?")[0];

  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(lower)) return "image";

  return "unknown";
}
