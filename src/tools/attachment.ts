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

export async function handleDownloadAttachment(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const id = args.id as number;
  const records = await odoo.read("ir.attachment", [id], [
    "name",
    "mimetype",
    "file_size",
    "datas",
  ]);

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

  const att = records[0] as Record<string, unknown>;
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
