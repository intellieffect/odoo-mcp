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

  const timeout = process.env.ODOO_TIMEOUT
    ? parseInt(process.env.ODOO_TIMEOUT, 10) * 1000
    : undefined;

  const odoo = new OdooClient({ url, db, apiKey, user, password, timeout });

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
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { error: (err as Error).message },
                null,
                2
              ),
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
