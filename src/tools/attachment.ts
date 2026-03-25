import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const listAttachmentsTool = {
  name: "list_attachments",
  description:
    "List attachments linked to a specific record. Returns file names, types, and sizes.",
  inputSchema: {
    res_model: z.string().describe("Model name the attachment belongs to (e.g., 'account.move')"),
    res_id: z.number().describe("Record ID the attachment belongs to"),
    limit: z.number().optional().describe("Maximum results. Default: 20"),
  },
};

export async function handleListAttachments(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const resModel = args.res_model as string;
  const resId = args.res_id as number;
  const limit = (args.limit as number) ?? 20;

  const records = await odoo.searchRead(
    "ir.attachment",
    [
      ["res_model", "=", resModel],
      ["res_id", "=", resId],
    ],
    ["id", "name", "mimetype", "file_size", "create_date"],
    limit
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: records.length, attachments: records }, null, 2),
      },
    ],
  };
}

export const uploadAttachmentTool = {
  name: "upload_attachment",
  description:
    "Upload a file attachment to a specific record. File content must be base64 encoded.",
  inputSchema: {
    res_model: z.string().describe("Model name to attach to (e.g., 'account.move')"),
    res_id: z.number().describe("Record ID to attach to"),
    name: z.string().describe("File name (e.g., 'invoice.pdf')"),
    data: z.string().describe("Base64 encoded file content"),
    mimetype: z
      .string()
      .optional()
      .describe("MIME type (e.g., 'application/pdf'). Auto-detected if omitted."),
  },
};

export async function handleUploadAttachment(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const values: Record<string, unknown> = {
    name: args.name,
    datas: args.data,
    res_model: args.res_model,
    res_id: args.res_id,
  };
  if (args.mimetype) values.mimetype = args.mimetype;

  const id = await odoo.create("ir.attachment", values);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, attachment_id: id }, null, 2),
      },
    ],
  };
}

export const downloadAttachmentTool = {
  name: "download_attachment",
  description:
    "Download an attachment by ID. Returns base64 encoded file content.",
  inputSchema: {
    id: z.number().describe("Attachment ID"),
  },
};

const MAX_DOWNLOAD_SIZE_MB = 25;
const MAX_DOWNLOAD_SIZE_BYTES = MAX_DOWNLOAD_SIZE_MB * 1024 * 1024;

export async function handleDownloadAttachment(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const id = args.id as number;

  // 먼저 메타데이터만 조회하여 파일 크기 확인
  const metaRecords = (await odoo.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
  ])) as Record<string, unknown>[];

  if (!metaRecords || metaRecords.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `Attachment ${id} not found` }, null, 2),
        },
      ],
      isError: true,
    };
  }

  const meta = metaRecords[0];
  const fileSize = meta.file_size as number;

  if (fileSize > MAX_DOWNLOAD_SIZE_BYTES) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `파일이 너무 큽니다 (${(fileSize / 1024 / 1024).toFixed(1)}MB). 최대 ${MAX_DOWNLOAD_SIZE_MB}MB까지 다운로드 가능합니다`,
              id,
              name: meta.name,
              file_size: fileSize,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // 크기 확인 후 실제 데이터 조회
  const records = (await odoo.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
    "datas",
  ])) as Record<string, unknown>[];

  const att = records[0];
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            id,
            name: att.name,
            mimetype: att.mimetype,
            file_size: att.file_size,
            data: att.datas,
          },
          null,
          2
        ),
      },
    ],
  };
}
