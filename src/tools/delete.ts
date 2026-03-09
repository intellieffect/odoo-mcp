import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const deleteRecordTool = {
  name: "delete_record",
  description:
    "Delete one or more records from an Odoo model. Use with caution — this is permanent.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner')"),
    ids: z.string().describe('Comma-separated record IDs to delete (e.g., "1,2,3")'),
  },
};

export async function handleDeleteRecord(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const ids = (args.ids as string).split(",").map((id) => parseInt(id.trim()));

  const result = await client.delete(model, ids);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: result, deleted_ids: ids }, null, 2),
      },
    ],
  };
}
