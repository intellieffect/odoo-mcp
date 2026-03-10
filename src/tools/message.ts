import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const getMessagesTool = {
  name: "get_messages",
  description:
    "Get chatter messages (comments, notes, activity logs) for a specific record.",
  inputSchema: {
    res_model: z
      .string()
      .describe("Model name (e.g., 'account.move', 'sale.order')"),
    res_id: z.number().describe("Record ID"),
    limit: z.number().optional().describe("Maximum messages. Default: 20"),
    message_type: z
      .string()
      .optional()
      .describe('Filter: "comment", "notification", "email". Default: all'),
  },
};

export async function handleGetMessages(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const resModel = args.res_model as string;
  const resId = args.res_id as number;
  const limit = (args.limit as number) ?? 20;

  const domain: unknown[] = [
    ["res_id", "=", resId],
    ["model", "=", resModel],
  ];

  if (args.message_type) {
    domain.push(["message_type", "=", args.message_type]);
  }

  const messages = await odoo.searchRead(
    "mail.message",
    domain,
    ["id", "body", "author_id", "date", "message_type", "subtype_id"],
    limit,
    undefined,
    "date desc"
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: messages.length, messages }, null, 2),
      },
    ],
  };
}

export const postMessageTool = {
  name: "post_message",
  description:
    "Post a message or internal note on a record's chatter.",
  inputSchema: {
    model: z.string().describe("Model name (e.g., 'account.move')"),
    id: z.number().describe("Record ID"),
    body: z.string().describe("Message body (HTML supported)"),
    message_type: z
      .string()
      .optional()
      .describe('"comment" (default) or "notification"'),
    subtype_xmlid: z
      .string()
      .optional()
      .describe('"mail.mt_comment" (default, notifies) or "mail.mt_note" (internal, no notification)'),
  },
};

export async function handlePostMessage(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const id = args.id as number;
  const body = args.body as string;
  const messageType = (args.message_type as string) || "comment";
  const subtypeXmlid = (args.subtype_xmlid as string) || "mail.mt_comment";

  const result = await odoo.callMethod(
    model,
    "message_post",
    [[id]],
    {
      body,
      message_type: messageType,
      subtype_xmlid: subtypeXmlid,
    }
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, message_id: result }, null, 2),
      },
    ],
  };
}
