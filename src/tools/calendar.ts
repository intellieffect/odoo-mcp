import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const searchCalendarTool = {
  name: "search_calendar",
  description:
    "Search calendar events. By default returns only events where the current user is an attendee. Use all_events=true to see all events.",
  inputSchema: {
    domain: z
      .string()
      .optional()
      .describe('Additional domain filter as JSON array. Default: []'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields. Default: "name,start,stop,partner_ids,location,description"'),
    limit: z.number().optional().describe("Maximum results. Default: 40"),
    all_events: z
      .boolean()
      .optional()
      .describe("If true, return all events (not just current user's). Default: false"),
  },
};

export async function handleSearchCalendar(
  odoo: OdooClient,
  args: Record<string, unknown>
) {
  const extraDomain = args.domain ? JSON.parse(args.domain as string) : [];
  const fields = args.fields
    ? (args.fields as string).split(",").map((f) => f.trim())
    : ["name", "start", "stop", "partner_ids", "location", "description"];
  const limit = (args.limit as number) ?? 40;
  const allEvents = (args.all_events as boolean) ?? false;

  let domain = [...extraDomain];

  if (!allEvents) {
    // Get current user's partner_id
    const users = await odoo.read("res.users", [odoo.getUid()], ["partner_id"]);
    if (users && users.length > 0) {
      const user = users[0] as Record<string, unknown>;
      const partnerId = (user.partner_id as [number, string])[0];
      domain.push(["partner_ids", "in", [partnerId]]);
    }
  }

  const records = await odoo.searchRead(
    "calendar.event",
    domain,
    fields,
    limit,
    undefined,
    "start asc"
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: records.length, events: records }, null, 2),
      },
    ],
  };
}
