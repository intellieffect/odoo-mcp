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
  let values: Record<string, unknown>;
  try {
    values = JSON.parse(args.values as string);
  } catch {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "values JSON 파싱 실패. 올바른 JSON을 입력하세요" }, null, 2) }],
      isError: true,
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
