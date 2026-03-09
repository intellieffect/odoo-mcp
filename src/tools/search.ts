import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const searchRecordsTool = {
  name: "search_records",
  description:
    "Search and read records from an Odoo model with optional domain filters, field selection, pagination, and ordering.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner', 'sale.order')"),
    domain: z
      .string()
      .optional()
      .describe(
        'Search domain as JSON array (e.g., \'[["is_company","=",true],["country_id.code","=","US"]]\'). Default: [] (all records)'
      ),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated field names to return (e.g., "name,email,phone"). Default: all fields'
      ),
    limit: z.number().optional().describe("Maximum number of records to return. Default: 80"),
    offset: z.number().optional().describe("Number of records to skip. Default: 0"),
    order: z
      .string()
      .optional()
      .describe('Sort order (e.g., "name asc", "create_date desc")'),
  },
};

export async function handleSearchRecords(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const domain = args.domain ? JSON.parse(args.domain as string) : [];
  const fields = args.fields
    ? (args.fields as string).split(",").map((f) => f.trim())
    : undefined;
  const limit = (args.limit as number) ?? 80;
  const offset = args.offset as number | undefined;
  const order = args.order as string | undefined;

  const records = await client.searchRead(model, domain, fields, limit, offset, order);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: records.length, records }, null, 2),
      },
    ],
  };
}
