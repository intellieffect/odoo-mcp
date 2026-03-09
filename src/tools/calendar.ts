import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const searchCalendarTool = {
  name: "search_calendar",
  description:
    "캘린더 일정을 조회합니다. 기본적으로 현재 인증된 사용자 본인의 일정 및 본인이 참석자로 포함된 일정만 반환합니다. all_events를 true로 설정하면 전체 일정을 조회할 수 있습니다.",
  inputSchema: {
    all_events: z
      .boolean()
      .optional()
      .describe(
        "true로 설정하면 모든 사용자의 일정을 조회합니다. 기본값: false (본인 일정만)"
      ),
    domain: z
      .string()
      .optional()
      .describe(
        '추가 필터 도메인 (JSON 배열). 예: \'[["start",">=","2026-03-01"]]\'. 기본 사용자 필터와 AND로 결합됩니다'
      ),
    fields: z
      .string()
      .optional()
      .describe(
        '조회할 필드 (쉼표 구분). 기본값: "name,start,stop,allday,user_id,partner_ids,location,description"'
      ),
    limit: z
      .number()
      .optional()
      .describe("최대 조회 건수. 기본값: 40"),
    order: z
      .string()
      .optional()
      .describe('정렬 순서. 기본값: "start asc"'),
  },
};

export async function handleSearchCalendar(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const allEvents = (args.all_events as boolean) ?? false;
  const defaultFields = "name,start,stop,allday,user_id,partner_ids,location,description";
  const fields = args.fields
    ? (args.fields as string).split(",").map((f) => f.trim())
    : defaultFields.split(",");
  const limit = (args.limit as number) ?? 40;
  const order = (args.order as string) || "start asc";

  let extraDomain: unknown[] = [];
  if (args.domain) {
    try {
      extraDomain = JSON.parse(args.domain as string);
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: "domain JSON 파싱 실패. 올바른 JSON 배열을 입력하세요" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  let domain: unknown[] = [...extraDomain];

  if (!allEvents) {
    const partnerId = await client.getPartnerId();
    const uid = client.uid;
    // 주최자(user_id)가 나이거나, 참석자(partner_ids)에 내가 포함된 일정
    domain.push("|");
    domain.push(["user_id", "=", uid]);
    domain.push(["partner_ids", "in", [partnerId]]);
  }

  const records = await client.searchRead(
    "calendar.event",
    domain,
    fields,
    limit,
    undefined,
    order
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            count: (records as unknown[]).length,
            filter: allEvents ? "전체 일정" : "내 일정만",
            records,
          },
          null,
          2
        ),
      },
    ],
  };
}
