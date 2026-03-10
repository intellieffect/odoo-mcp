import { z } from "zod";
import type { OdooClient } from "../odoo-client.js";

export const listModelsTool = {
  name: "list_models",
  description:
    "List all available Odoo models (ir.model). Returns model technical name, display name, and state.",
  inputSchema: {
    filter: z
      .string()
      .optional()
      .describe(
        'Optional text filter to match model name or technical name (e.g., "sale", "partner")'
      ),
    include_transient: z
      .boolean()
      .optional()
      .describe("Include transient (wizard) models. Default: false"),
  },
};

export async function handleListModels(
  client: OdooClient,
  args: Record<string, unknown>
) {
  const records = (await client.listModels()) as Array<Record<string, unknown>>;
  const filter = args.filter as string | undefined;
  const includeTransient = (args.include_transient as boolean) ?? false;

  let models = records.map((r) => ({
    model: r.model,
    name: r.name,
    state: r.state,
    transient: r.transient,
  }));

  // Filter out transient models by default
  if (!includeTransient) {
    models = models.filter((m) => !m.transient);
  }

  if (filter) {
    const f = filter.toLowerCase();
    models = models.filter(
      (m) =>
        (m.model as string).toLowerCase().includes(f) ||
        (m.name as string).toLowerCase().includes(f)
    );
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ count: models.length, models }, null, 2),
      },
    ],
  };
}
