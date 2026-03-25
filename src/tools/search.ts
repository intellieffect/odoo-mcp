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
        'Comma-separated field names to return (e.g., "name,email,phone"). Default: "id,name,display_name"'
      ),
    limit: z.number().optional().describe("Maximum number of records to return. Default: 80"),
    offset: z.number().optional().describe("Number of records to skip. Default: 0"),
    order: z
      .string()
      .optional()
      .describe('Sort order (e.g., "name asc", "create_date desc")'),
    include_total: z
      .boolean()
      .optional()
      .describe("Include total_count via count query. Default: false (uses limit+1 for has_more). Set true when exact total is needed."),
  },
};

const DEFAULT_FIELDS = ["id", "name", "display_name"];

export async function handleSearchRecords(
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

  const fields = args.fields
    ? (args.fields as string).split(",").map((f) => f.trim())
    : DEFAULT_FIELDS;
  const limit = (args.limit as number) ?? 80;
  const offset = (args.offset as number) ?? 0;
  const order = args.order as string | undefined;

  const includeTotal = (args.include_total as boolean) ?? false;

  if (includeTotal) {
    const [records, totalCount] = await Promise.all([
      client.searchRead(model, domain, fields, limit, offset, order),
      client.count(model, domain),
    ]);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            count: records.length,
            offset,
            limit,
            total_count: totalCount,
            has_more: offset + records.length < totalCount,
            records,
          }, null, 2),
        },
      ],
    };
  }

  // limit+1 트릭으로 has_more 판단 — count RPC 호출 불필요
  const records = (await client.searchRead(model, domain, fields, limit + 1, offset, order)) as unknown[];
  const hasMore = records.length > limit;
  if (hasMore) records.pop();

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          count: records.length,
          offset,
          limit,
          has_more: hasMore,
          records,
        }, null, 2),
      },
    ],
  };
}
