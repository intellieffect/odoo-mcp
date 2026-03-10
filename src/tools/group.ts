import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const searchGroupedTool = {
  name: "search_grouped",
  description:
    "Group and aggregate records using Odoo's read_group. Useful for monthly sales totals, counts by status, sums by partner, etc.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'account.move')"),
    domain: z
      .string()
      .optional()
      .describe('Search domain as JSON array. Default: []'),
    fields: z
      .string()
      .describe(
        'Comma-separated fields to aggregate (e.g., "amount_total,amount_untaxed"). Include the groupby field too.'
      ),
    groupby: z
      .string()
      .describe(
        'Comma-separated fields to group by (e.g., "partner_id", "state", "date:month")'
      ),
    orderby: z.string().optional().describe('Sort order (e.g., "amount_total desc")'),
    limit: z.number().optional().describe("Maximum number of groups to return"),
    lazy: z
      .boolean()
      .optional()
      .describe("If true, only group by the first field. Default: true"),
  },
};

export async function handleSearchGrouped(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const domain = args.domain ? JSON.parse(args.domain as string) : [];
  const fields = (args.fields as string).split(",").map((f) => f.trim());
  const groupby = (args.groupby as string).split(",").map((f) => f.trim());
  const orderby = args.orderby as string | undefined;
  const limit = args.limit as number | undefined;
  const lazy = args.lazy as boolean | undefined;

  const groups = await odoo.readGroup(model, domain, fields, groupby, orderby, limit, lazy);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: groups.length, groups }, null, 2),
      },
    ],
  };
}
