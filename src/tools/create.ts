import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const createRecordTool = {
  name: "create_record",
  description: "Create one or more records in an Odoo model. Pass a JSON object for single record, or a JSON array of objects for batch creation.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner')"),
    values: z
      .string()
      .describe(
        'JSON object with field values (e.g., \'{"name":"John","email":"john@example.com"}\')'
      ),
  },
};

export async function handleCreateRecord(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const values = JSON.parse(args.values as string);

  if (Array.isArray(values)) {
    // Batch create
    const ids: number[] = [];
    for (const v of values) {
      ids.push(await client.create(model, v));
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, count: ids.length, ids }, null, 2),
        },
      ],
    };
  }

  const id = await client.create(model, values);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, id }, null, 2),
      },
    ],
  };
}
