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

  let domain: unknown[] = [];
  if (args.domain) {
    try {
      domain = JSON.parse(args.domain as string);
    } catch {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "domain JSON 파싱 실패. 올바른 JSON 배열을 입력하세요" }, null, 2) }],
        isError: true,
      };
    }
  }

  const fields = (args.fields as string)
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (fields.length === 0) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "fields가 비어있습니다. 집계할 필드를 지정하세요 (예: 'amount_total:sum,name')" }, null, 2) }],
      isError: true,
    };
  }

  const groupby = (args.groupby as string)
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);

  if (groupby.length === 0) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "groupby가 비어있습니다. 그룹핑할 필드를 지정하세요 (예: 'partner_id,state')" }, null, 2) }],
      isError: true,
    };
  }

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
          {
            model,
            group_count: result.length,
            ...(result.length === 0 ? { message: "조건에 맞는 그룹이 없습니다" } : {}),
            groups: result,
          },
          null,
          2
        ),
      },
    ],
  };
}
