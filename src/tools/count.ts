import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const countRecordsTool = {
  name: "count_records",
  description: "Count records in an Odoo model matching an optional domain filter.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner')"),
    domain: z
      .string()
      .optional()
      .describe(
        'Search domain as JSON array (e.g., \'[["is_company","=",true]]\'). Default: [] (all records)'
      ),
  },
};

export async function handleCountRecords(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const domain = args.domain ? JSON.parse(args.domain as string) : [];

  const count = await client.count(model, domain);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ model, count }, null, 2),
      },
    ],
  };
}
