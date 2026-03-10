import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OdooClient } from "./odoo-client.js";

import { searchRecordsTool, handleSearchRecords } from "./tools/search.js";
import { readRecordTool, handleReadRecord } from "./tools/read.js";
import { createRecordTool, handleCreateRecord } from "./tools/create.js";
import { updateRecordTool, handleUpdateRecord } from "./tools/update.js";
import { deleteRecordTool, handleDeleteRecord } from "./tools/delete.js";
import { countRecordsTool, handleCountRecords } from "./tools/count.js";
import { listModelsTool, handleListModels } from "./tools/models.js";
import { getFieldsTool, handleGetFields } from "./tools/fields.js";

function classifyError(message: string): {
  error_type: string;
  error: string;
  detail?: string;
} {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("doesn't exist") || lowerMsg.includes("does not exist")) {
    const modelMatch = message.match(/Object (\S+) doesn't exist/);
    return {
      error_type: "model_not_found",
      error: modelMatch
        ? `모델 '${modelMatch[1]}'을(를) 찾을 수 없습니다. 모델명을 확인하거나 접근 권한을 확인하세요.`
        : "모델을 찾을 수 없습니다. 모델명 또는 접근 권한을 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("access denied") || lowerMsg.includes("accesserror")) {
    return {
      error_type: "access_denied",
      error: "접근 권한이 없습니다. 현재 사용자의 권한을 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("invalid field")) {
    const fieldMatch = message.match(/Invalid field '(\S+?)'/);
    const modelMatch = message.match(/on '(\S+?)'/);
    return {
      error_type: "field_not_found",
      error: fieldMatch
        ? `필드 '${fieldMatch[1]}'이(가) 모델${modelMatch ? ` '${modelMatch[1]}'` : ""}에 존재하지 않습니다. get_fields로 사용 가능한 필드를 확인하세요.`
        : "존재하지 않는 필드입니다. get_fields로 사용 가능한 필드를 확인하세요.",
      detail: message,
    };
  }

  if (lowerMsg.includes("validationerror") || lowerMsg.includes("validation error")) {
    return {
      error_type: "validation_error",
      error: "데이터 검증 오류가 발생했습니다.",
      detail: message,
    };
  }

  if (lowerMsg.includes("authentication failed")) {
    return {
      error_type: "auth_failed",
      error: "인증에 실패했습니다. ODOO_URL, ODOO_DB, 인증 정보를 확인하세요.",
      detail: message,
    };
  }

  // Traceback이 포함된 긴 에러 → 핵심만 추출
  if (message.includes("Traceback")) {
    const lines = message.split("\n");
    const lastLine = lines.filter((l) => l.trim() && !l.startsWith(" ")).pop() || message;
    return {
      error_type: "server_error",
      error: `Odoo 서버 에러: ${lastLine.replace(/^.*?Error:\s*/, "").trim()}`,
      detail: message.length > 500 ? message.slice(-500) : message,
    };
  }

  return {
    error_type: "unknown",
    error: message,
  };
}

async function main() {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const apiKey = process.env.ODOO_API_KEY;
  const user = process.env.ODOO_USER;
  const password = process.env.ODOO_PASSWORD;

  if (!url || !db) {
    console.error("ODOO_URL and ODOO_DB environment variables are required.");
    process.exit(1);
  }

  if (!apiKey && !(user && password)) {
    console.error(
      "Either ODOO_API_KEY or both ODOO_USER and ODOO_PASSWORD are required."
    );
    process.exit(1);
  }

  const odoo = new OdooClient({ url, db, apiKey, user, password });

  try {
    await odoo.connect();
  } catch (err) {
    console.error("Failed to connect to Odoo:", (err as Error).message);
    process.exit(1);
  }

  const server = new McpServer({
    name: "odoo-mcp",
    version: "0.1.0",
  });

  // Register tools
  const tools = [
    { def: searchRecordsTool, handler: handleSearchRecords },
    { def: readRecordTool, handler: handleReadRecord },
    { def: createRecordTool, handler: handleCreateRecord },
    { def: updateRecordTool, handler: handleUpdateRecord },
    { def: deleteRecordTool, handler: handleDeleteRecord },
    { def: countRecordsTool, handler: handleCountRecords },
    { def: listModelsTool, handler: handleListModels },
    { def: getFieldsTool, handler: handleGetFields },
  ];

  for (const { def, handler } of tools) {
    server.tool(def.name, def.description, def.inputSchema, async (args: Record<string, unknown>) => {
      try {
        return await handler(odoo, args as Record<string, unknown>);
      } catch (err) {
        const message = (err as Error).message || String(err);
        const classified = classifyError(message);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(classified, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
