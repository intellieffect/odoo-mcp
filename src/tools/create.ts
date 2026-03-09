import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const createRecordTool = {
  name: "create_record",
  description:
    "Create one or more records in an Odoo model. Supports both single and batch creation.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner')"),
    values: z
      .string()
      .describe(
        'JSON object for single record or JSON array of objects for batch creation. Single: \'{"name":"John","email":"john@example.com"}\'. Batch: \'[{"name":"John"},{"name":"Jane"}]\''
      ),
  },
};

export async function handleCreateRecord(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const parsed = JSON.parse(args.values as string);

  if (Array.isArray(parsed)) {
    // Batch create
    const ids: number[] = [];
    for (const values of parsed) {
      const id = await client.create(model, values);
      ids.push(id);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { success: true, count: ids.length, ids },
            null,
            2
          ),
        },
      ],
    };
  } else {
    // Single create
    const id = await client.create(model, parsed);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, id }, null, 2),
        },
      ],
    };
  }
}
