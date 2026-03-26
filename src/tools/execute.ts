import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const executeMethodTool = {
  name: "execute_method",
  description:
    "Execute a method on Odoo model records. Used for workflow actions (action_confirm, action_post, button_validate, etc.) and custom business logic methods.",
  inputSchema: {
    model: z
      .string()
      .describe("Odoo model name (e.g., 'sale.order', 'account.move')"),
    method: z
      .string()
      .describe(
        "Method name to call (e.g., 'action_confirm', 'action_post', 'button_validate')"
      ),
    ids: z
      .string()
      .describe('Comma-separated record IDs (e.g., "1,2,3")'),
    args: z
      .string()
      .optional()
      .describe(
        "Additional positional arguments as JSON array (e.g., '[\"arg1\", 2]'). Default: []"
      ),
    kwargs: z
      .string()
      .optional()
      .describe(
        'Additional keyword arguments as JSON object (e.g., \'{"key": "value"}\'). Default: {}'
      ),
  },
};

export async function handleExecuteMethod(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const model = args.model as string;
  const method = args.method as string;
  const ids = (args.ids as string).split(",").map((s) => {
    const id = parseInt(s.trim(), 10);
    if (isNaN(id)) throw new Error(`Invalid record ID: "${s.trim()}"`);
    return id;
  });

  let extraArgs: unknown[] = [];
  if (args.args) {
    try {
      extraArgs = JSON.parse(args.args as string);
    } catch {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "args JSON 파싱 실패. 올바른 JSON 배열을 입력하세요" }, null, 2) }],
        isError: true,
      };
    }
    if (!Array.isArray(extraArgs)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "args must be a JSON array" }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  let kwargs: Record<string, unknown> = {};
  if (args.kwargs) {
    try {
      kwargs = JSON.parse(args.kwargs as string);
    } catch {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "kwargs JSON 파싱 실패. 올바른 JSON 객체를 입력하세요" }, null, 2) }],
        isError: true,
      };
    }
    if (kwargs === null || typeof kwargs !== "object" || Array.isArray(kwargs)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "kwargs must be a JSON object" }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  let result: unknown;
  try {
    result = await client.executeMethod(model, method, ids, extraArgs, kwargs);
  } catch (err) {
    const msg = (err as Error).message || "";
    if (msg.includes("cannot marshal None")) {
      // Method executed successfully but returned None,
      // which XML-RPC cannot serialize. Treat as success.
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                model,
                method,
                ids,
                result: null,
                note: "Method executed successfully (returned None)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
    throw err;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ model, method, ids, result }, null, 2),
      },
    ],
  };
}
