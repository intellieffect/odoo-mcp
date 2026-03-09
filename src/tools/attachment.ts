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

export async function handleUploadAttachment(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const values: Record<string, unknown> = {
    name: args.name,
    res_model: args.model,
    res_id: args.res_id,
    datas: args.data,
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

export async function handleDownloadAttachment(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const id = args.id as number;

  const records = (await client.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
    "datas",
  ])) as Record<string, unknown>[];

  if (!records || records.length === 0) {
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
