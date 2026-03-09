import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const searchGroupedTool = {
  name: "search_grouped",
  description:
    "Search and aggregate records using Odoo's read_group. Returns grouped results with aggregated values (sum, count, avg, etc.).",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'account.move')"),
    domain: z
      .string()
      .optional()
      .describe(
        'Search domain as JSON array (e.g., \'[["state","=","posted"]]\'). Default: [] (all records)'
      ),
    fields: z
      .string()
      .describe(
        'Comma-separated fields to aggregate (e.g., "amount_total:sum,name"). Use field:agg syntax for specific aggregations'
      ),
    groupby: z
      .string()
      .describe(
        'Comma-separated fields to group by (e.g., "partner_id,state", "date_order:month")'
      ),
    orderby: z
      .string()
      .optional()
      .describe('Sort order (e.g., "amount_total desc"). Default: none'),
    limit: z.number().optional().describe("Maximum number of groups to return"),
    lazy: z
      .boolean()
      .optional()
      .describe(
        "If true, only group by the first field; sub-groups returned via __context. Default: true"
      ),
  },
};

export async function handleSearchGrouped(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const domain = args.domain ? JSON.parse(args.domain as string) : [];
  const fields = (args.fields as string).split(",").map((f) => f.trim());
  const groupby = (args.groupby as string).split(",").map((g) => g.trim());
  const orderby = args.orderby as string | undefined;
  const limit = args.limit as number | undefined;
  const lazy = args.lazy as boolean | undefined;

  const result = await client.readGroup(
    model,
    domain,
    fields,
    groupby,
    orderby,
    limit,
    lazy
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { model, group_count: (result as unknown[]).length, groups: result },
          null,
          2
        ),
      },
    ],
  };
}
