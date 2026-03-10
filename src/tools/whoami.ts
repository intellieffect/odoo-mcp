import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const whoamiTool = {
  name: "whoami",
  description:
    "Show current connection info: authenticated user, database, server version, and user's permission groups.",
  inputSchema: {},
};

export async function handleWhoami(
  odoo: OdooClient,
  _args: Record<string, unknown>
) {
  const uid = odoo.getUid();
  const db = odoo.getDb();
  const url = odoo.getUrl();

  // Server version
  const versionInfo = await odoo.getVersion();

  // User info
  const users = await odoo.read("res.users", [uid], [
    "name",
    "login",
    "partner_id",
    "company_id",
    "group_ids",
  ]);

  if (!users || users.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Could not read current user info" }, null, 2),
        },
      ],
      isError: true,
    };
  }

  const user = users[0] as Record<string, unknown>;

  // Read group names
  const groupIds = user.group_ids as number[];
  let groups: string[] = [];
  if (groupIds && groupIds.length > 0) {
    const groupRecords = await odoo.read("res.groups", groupIds, [
      "full_name",
    ]);
    groups = (groupRecords as Record<string, unknown>[]).map(
      (g) => g.full_name as string
    );
    groups.sort();
  }

  const result = {
    uid,
    name: user.name,
    email: user.login,
    partner_id: user.partner_id,
    company_id: user.company_id,
    db,
    url,
    server_version: versionInfo.server_version,
    server_version_info: versionInfo.server_version_info,
    groups,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
