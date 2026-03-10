import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const whoamiTool = {
  name: "whoami",
  description:
    "Show current connection info: authenticated user, uid, partner, company, server version, and database name.",
  inputSchema: {},
};

export async function handleWhoami(
  client: OdooClient,
  _args: Record<string, unknown>
) {
  // 서버 버전 조회
  const version = await client.getVersion();

  // 현재 사용자 정보 조회
  const uid = client.getUid();
  const users = (await client.searchRead(
    "res.users",
    [["id", "=", uid]],
    [
      "name",
      "login",
      "email",
      "partner_id",
      "company_id",
      "company_ids",
      "group_ids",
      "lang",
      "tz",
    ],
    1
  )) as Array<Record<string, unknown>>;

  const user = users[0] || {};

  // 권한 그룹 이름 조회 (주요 그룹만)
  const groupIds = (user.group_ids as number[]) || [];
  let groups: string[] = [];
  if (groupIds.length > 0) {
    const groupRecords = (await client.searchRead(
      "res.groups",
      [["id", "in", groupIds]],
      ["full_name"],
      200
    )) as Array<Record<string, unknown>>;
    groups = groupRecords
      .map((g) => g.full_name as string)
      .filter(
        (name) =>
          name.includes("Admin") ||
          name.includes("Manager") ||
          name.includes("User") ||
          name.includes("Officer") ||
          name.includes("Billing")
      )
      .sort();
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            uid,
            name: user.name,
            login: user.login,
            email: user.email,
            partner_id: user.partner_id,
            company_id: user.company_id,
            company_ids: user.company_ids,
            lang: user.lang,
            tz: user.tz,
            groups: groups,
            server: {
              version: version.server_version,
              protocol_version: version.protocol_version,
            },
            database: client.getDatabase(),
          },
          null,
          2
        ),
      },
    ],
  };
}
