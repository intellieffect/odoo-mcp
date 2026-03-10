import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";
import type { OdooDomain } from "../types.js";

const DEFAULT_FIELDS = ["id", "name", "display_name"];

export const searchRecordsTool = {
  name: "search_records",
  description:
    "Search and read records from an Odoo model. If fields is not specified, only id/name/display_name are returned to keep response compact. Always specify the fields you need.",
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
        'Comma-separated field names to return (e.g., "name,email,phone"). Default: "id,name,display_name". Specify fields to get relevant data'
      ),
    limit: z.number().int().positive().optional().describe("Maximum number of records to return. Must be a positive integer. Default: 80"),
    offset: z.number().int().min(0).optional().describe("Number of records to skip. Must be a non-negative integer. Default: 0"),
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
  let domain: OdooDomain = [];
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

  const fieldsSpecified = !!args.fields;
  const fields = args.fields
    ? (args.fields as string).split(",").map((f) => f.trim())
    : DEFAULT_FIELDS;
  const limit = (args.limit as number) ?? 80;
  const offset = (args.offset as number) ?? 0;
  const order = args.order as string | undefined;

  // total_count 조회 (페이지네이션 안내용)
  const totalCount = await client.count(model, domain);
  const records = await client.searchRead(model, domain, fields, limit, offset, order);
  const hasMore = offset + (records as unknown[]).length < totalCount;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          count: (records as unknown[]).length,
          total_count: totalCount,
          offset,
          limit,
          has_more: hasMore,
          ...(!fieldsSpecified ? { notice: "fields 미지정 — 기본 필드(id,name,display_name)만 반환됨. 필요한 필드를 지정하세요" } : {}),
          records,
        }, null, 2),
      },
    ],
  };
}

