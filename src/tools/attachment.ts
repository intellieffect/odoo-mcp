import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";
import type { OdooDomain } from "../types.js";

export const listAttachmentsTool = {
  name: "list_attachments",
  description:
    "List file attachments on a specific Odoo record or search all attachments.",
  inputSchema: {
    model: z
      .string()
      .optional()
      .describe(
        "Odoo model name to filter by (e.g., 'sale.order'). If omitted, searches all attachments"
      ),
    res_id: z
      .number()
      .optional()
      .describe("Record ID to filter by. Used together with model"),
    domain: z
      .string()
      .optional()
      .describe(
        'Additional domain filter as JSON array. Default: []'
      ),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of attachments to return. Default: 20"),
  },
};

export async function handleListAttachments(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string | undefined;
  const resId = args.res_id as number | undefined;
  const extraDomain = args.domain ? JSON.parse(args.domain as string) : [];
  const limit = (args.limit as number) ?? 20;

  const domain: OdooDomain = [...extraDomain];
  if (model) domain.push(["res_model", "=", model]);
  if (resId !== undefined) domain.push(["res_id", "=", resId]);

  const attachments = await client.searchRead(
    "ir.attachment",
    domain,
    [
      "name",
      "mimetype",
      "file_size",
      "res_model",
      "res_id",
      "create_date",
      "type",
      "url",
    ],
    limit,
    undefined,
    "create_date desc"
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { count: (attachments as unknown[]).length, attachments },
          null,
          2
        ),
      },
    ],
  };
}

export const uploadAttachmentTool = {
  name: "upload_attachment",
  description:
    "Upload a file attachment to an Odoo record. File content must be base64-encoded.",
  inputSchema: {
    name: z.string().describe("File name (e.g., 'report.pdf')"),
    model: z
      .string()
      .describe("Odoo model to attach to (e.g., 'res.partner')"),
    res_id: z.number().describe("Record ID to attach the file to"),
    data: z.string().describe("Base64-encoded file content"),
    mimetype: z
      .string()
      .optional()
      .describe(
        "MIME type (e.g., 'application/pdf', 'image/png'). Auto-detected if not provided"
      ),
    description: z.string().optional().describe("Optional file description"),
  },
};

const BASE64_REGEX = /^[A-Za-z0-9+/\n\r]+=*$/;

export async function handleUploadAttachment(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const data = args.data as string;

  // base64 유효성 검증
  if (!BASE64_REGEX.test(data.replace(/\s/g, ""))) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "유효하지 않은 base64 데이터입니다" }, null, 2) }],
      isError: true,
    };
  }

  const values: Record<string, unknown> = {
    name: args.name,
    res_model: args.model,
    res_id: args.res_id,
    datas: data,
    type: "binary",
  };

  if (args.mimetype) values.mimetype = args.mimetype;
  if (args.description) values.description = args.description;

  const id = await client.create("ir.attachment", values);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { success: true, attachment_id: id, name: args.name },
          null,
          2
        ),
      },
    ],
  };
}

export const downloadAttachmentTool = {
  name: "download_attachment",
  description:
    "Download/read an attachment by ID. Returns the base64-encoded file content.",
  inputSchema: {
    id: z.number().describe("Attachment ID to download"),
  },
};

const MAX_DOWNLOAD_SIZE_MB = 25;
const MAX_DOWNLOAD_SIZE_BYTES = MAX_DOWNLOAD_SIZE_MB * 1024 * 1024;

export async function handleDownloadAttachment(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const id = args.id as number;

  // 먼저 메타데이터만 조회하여 파일 크기 확인
  const metaRecords = (await client.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
  ])) as Record<string, unknown>[];

  if (!metaRecords || metaRecords.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `첨부파일 ID ${id}를 찾을 수 없습니다` }, null, 2),
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
              mimetype: meta.mimetype,
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
  const records = (await client.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
    "datas",
  ])) as Record<string, unknown>[];

  const attachment = records[0];
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            id,
            name: attachment.name,
            mimetype: attachment.mimetype,
            file_size: attachment.file_size,
            data: attachment.datas,
          },
          null,
          2
        ),
      },
    ],
  };
}
