import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

// 전용 도구가 있는 위험한 메서드는 execute_method로 호출 불가
// create_record, update_record, delete_record 도구를 사용할 것
const BLOCKED_METHODS = new Set([
  "create",
  "write",
  "unlink",
  "copy",
  "name_create",
  "web_save",
]);

export const executeMethodTool = {
  name: "execute_method",
  description:
    "Execute a method on Odoo model records. Used for workflow actions (action_confirm, action_post, button_validate, etc.) and custom business logic methods. Note: create/write/unlink are blocked — use dedicated tools instead.",
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
  const model = (args.model as string).trim();
  const method = (args.method as string).trim();

  if (!model) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "model은 필수입니다" }, null, 2) }],
      isError: true,
    };
  }

  if (!method) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "method는 필수입니다" }, null, 2) }],
      isError: true,
    };
  }

  if (BLOCKED_METHODS.has(method)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `'${method}' 메서드는 execute_method로 호출할 수 없습니다. 전용 도구를 사용하세요: create_record, update_record, delete_record`,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const idStrings = (args.ids as string)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (idStrings.length === 0) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "ids가 비어있습니다. 하나 이상의 레코드 ID를 입력하세요" }, null, 2) }],
      isError: true,
    };
  }

  const ids = idStrings.map((s) => {
    const id = parseInt(s, 10);
    if (isNaN(id) || id <= 0) throw new Error(`유효하지 않은 레코드 ID: "${s}"`);
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
