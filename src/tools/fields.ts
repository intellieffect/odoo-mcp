import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const getFieldsTool = {
  name: "get_fields",
  description:
    "Get field definitions for an Odoo model. Returns field names, types, labels, and other metadata.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner')"),
    attributes: z
      .string()
      .optional()
      .describe(
        'Comma-separated field attributes to return (e.g., "string,type,required,help"). Default: all attributes'
      ),
  },
};

const DEFAULT_ATTRIBUTES = ["string", "type", "required", "readonly", "relation", "selection"];

export async function handleGetFields(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const attributes = args.attributes
    ? (args.attributes as string).split(",").map((a) => a.trim())
    : DEFAULT_ATTRIBUTES;

  const fields = await client.getFields(model, attributes);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(fields, null, 2),
      },
    ],
  };
}
