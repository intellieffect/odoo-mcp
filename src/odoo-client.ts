import xmlrpc from "xmlrpc";
import type {
  OdooConfig,
  OdooConnectionParams,
  OdooDomain,
} from "./types.js";

function createClient(url: string, path: string) {
  const parsed = new URL(path, url);
  const isSecure = parsed.protocol === "https:";
  const options = {
    host: parsed.hostname,
    port: parsed.port
      ? parseInt(parsed.port)
      : isSecure
        ? 443
        : 80,
    path: parsed.pathname,
  };
  return isSecure
    ? xmlrpc.createSecureClient(options)
    : xmlrpc.createClient(options);
}

function call(
  client: xmlrpc.Client,
  method: string,
  params: unknown[]
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: Error | null, value: unknown) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

export class OdooClient {
  private config: OdooConfig | null = null;
  private params: OdooConnectionParams;
  private _partnerId: number | null = null;

  constructor(params: OdooConnectionParams) {
    this.params = params;
  }

  get uid(): number {
    if (!this.config) throw new Error("Not connected. Call connect() first.");
    return this.config.uid;
  }

  async getPartnerId(): Promise<number> {
    if (this._partnerId) return this._partnerId;
    const users = (await this.read("res.users", [this.uid], ["partner_id"])) as Record<string, unknown>[];
    if (users.length > 0 && Array.isArray(users[0].partner_id)) {
      this._partnerId = users[0].partner_id[0] as number;
    } else {
      throw new Error("현재 사용자의 partner_id를 조회할 수 없습니다");
    }
    return this._partnerId;
  }

  async connect(): Promise<void> {
    const { url, db, apiKey, user, password } = this.params;

    if (apiKey) {
      // With API key, we need to authenticate to get the uid
      const commonClient = createClient(url, "/xmlrpc/2/common");
      const uid = (await call(commonClient, "authenticate", [
        db,
        user || "",
        apiKey,
        {},
      ])) as number;

      if (!uid) {
        throw new Error(
          "Authentication failed. Check your ODOO_URL, ODOO_DB, and ODOO_API_KEY."
        );
      }

      this.config = { url, db, uid, password: apiKey };
    } else if (user && password) {
      const commonClient = createClient(url, "/xmlrpc/2/common");
      const uid = (await call(commonClient, "authenticate", [
        db,
        user,
        password,
        {},
      ])) as number;

      if (!uid) {
        throw new Error(
          "Authentication failed. Check your ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_PASSWORD."
        );
      }

      this.config = { url, db, uid, password };
    } else {
      throw new Error(
        "Either ODOO_API_KEY or ODOO_USER + ODOO_PASSWORD must be provided."
      );
    }
  }

  private getObjectClient() {
    if (!this.config) throw new Error("Not connected. Call connect() first.");
    return createClient(this.config.url, "/xmlrpc/2/object");
  }

  private async execute(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.config) throw new Error("Not connected. Call connect() first.");
    const client = this.getObjectClient();
    return call(client, "execute_kw", [
      this.config.db,
      this.config.uid,
      this.config.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  async searchRead(
    model: string,
    domain: OdooDomain = [],
    fields?: string[],
    limit?: number,
    offset?: number,
    order?: string
  ): Promise<unknown[]> {
    const kwargs: Record<string, unknown> = {};
    if (fields && fields.length > 0) kwargs.fields = fields;
    if (limit !== undefined) kwargs.limit = limit;
    if (offset !== undefined) kwargs.offset = offset;
    if (order) kwargs.order = order;

    return (await this.execute(
      model,
      "search_read",
      [domain],
      kwargs
    )) as unknown[];
  }

  async read(
    model: string,
    ids: number[],
    fields?: string[]
  ): Promise<unknown[]> {
    const kwargs: Record<string, unknown> = {};
    if (fields && fields.length > 0) kwargs.fields = fields;

    return (await this.execute(model, "read", [ids], kwargs)) as unknown[];
  }

  async create(
    model: string,
    values: Record<string, unknown>
  ): Promise<number> {
    return (await this.execute(model, "create", [values])) as number;
  }

  async update(
    model: string,
    ids: number[],
    values: Record<string, unknown>
  ): Promise<boolean> {
    return (await this.execute(model, "write", [ids, values])) as boolean;
  }

  async delete(model: string, ids: number[]): Promise<boolean> {
    return (await this.execute(model, "unlink", [ids])) as boolean;
  }

  async count(model: string, domain: OdooDomain = []): Promise<number> {
    return (await this.execute(
      model,
      "search_count",
      [domain]
    )) as number;
  }

  async listModels(): Promise<unknown[]> {
    return this.searchRead(
      "ir.model",
      [],
      ["model", "name", "state", "transient"],
      undefined,
      undefined,
      "model"
    );
  }

  async getFields(
    model: string,
    attributes?: string[]
  ): Promise<unknown> {
    const kwargs: Record<string, unknown> = {};
    if (attributes && attributes.length > 0) kwargs.attributes = attributes;

    return this.execute(model, "fields_get", [], kwargs);
  }
}
