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
    // Batch create — track partial failures
    const ids: number[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    for (let i = 0; i < values.length; i++) {
      try {
        ids.push(await client.create(model, values[i]));
      } catch (err) {
        errors.push({ index: i, error: (err as Error).message });
      }
    }
    const result: Record<string, unknown> = {
      success: errors.length === 0,
      created: ids.length,
      total: values.length,
      ids,
    };
    if (errors.length > 0) {
      result.errors = errors;
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
      ...(errors.length > 0 ? { isError: true } : {}),
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
