import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const nameSearchTool = {
  name: "name_search",
  description:
    "Search records by name with autocomplete-style matching. Returns [id, display_name] pairs. Useful for quickly finding records by partial name before setting relation fields.",
  inputSchema: {
    model: z.string().describe("Odoo model name (e.g., 'res.partner', 'product.product')"),
    name: z.string().describe("Search text (partial name match)"),
    domain: z
      .string()
      .optional()
      .describe('Additional domain filter as JSON array. Default: []'),
    operator: z
      .string()
      .optional()
      .describe('Match operator: "ilike" (default), "like", "=", "=like", "=ilike"'),
    limit: z.number().optional().describe("Maximum results. Default: 10"),
  },
};

export async function handleNameSearch(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const name = args.name as string;
  const domain = args.domain ? JSON.parse(args.domain as string) : [];
  const operator = (args.operator as string) || "ilike";
  const limit = (args.limit as number) ?? 10;

  const results = await odoo.nameSearch(model, name, domain, operator, limit);

  // name_search returns [[id, name], ...]
  const records = (results as [number, string][]).map(([id, displayName]) => ({
    id,
    display_name: displayName,
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: records.length, records }, null, 2),
      },
    ],
  };
}
