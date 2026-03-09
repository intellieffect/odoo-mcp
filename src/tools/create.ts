import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const createRecordTool = {
  name: "create_record",
  description: "Create a new record in an Odoo model.",
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
