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
  odoo: OdooClient,
  params: Record<string, unknown>
) {
  const model = params.model as string;
  const method = params.method as string;
  const ids = (params.ids as string).split(",").map((id) => parseInt(id.trim(), 10));

  let args: unknown[] = [];
  if (params.args) {
    args = JSON.parse(params.args as string);
    if (!Array.isArray(args)) {
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
  if (params.kwargs) {
    kwargs = JSON.parse(params.kwargs as string);
    if (typeof kwargs !== "object" || Array.isArray(kwargs)) {
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
    result = await odoo.executeMethod(model, method, ids, args, kwargs);
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
