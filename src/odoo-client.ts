import xmlrpc from "xmlrpc";
import type {
  OdooConfig,
  OdooConnectionParams,
  OdooDomain,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30000;

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
  params: unknown[],
  timeoutMs?: number
): Promise<unknown> {
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`XML-RPC request timed out after ${timeout}ms`));
    }, timeout);

    client.methodCall(method, params, (err: any, value: any) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    });
  });
}

export class OdooClient {
  private config: OdooConfig | null = null;
  private params: OdooConnectionParams;
  private timeoutMs: number;
  private objectClient: xmlrpc.Client | null = null;
  private commonClient: xmlrpc.Client | null = null;

  constructor(params: OdooConnectionParams, timeoutMs?: number) {
    this.params = params;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async connect(): Promise<void> {
    const { url, db, apiKey, user, password } = this.params;

    // commonClient 캐싱
    if (!this.commonClient) {
      this.commonClient = createClient(url, "/xmlrpc/2/common");
    }

    if (apiKey) {
      // With API key, we need to authenticate to get the uid
      const uid = (await call(this.commonClient, "authenticate", [
        db,
        user || "",
        apiKey,
        {},
      ], this.timeoutMs)) as number;

      if (!uid) {
        throw new Error(
          "Authentication failed. Check your ODOO_URL, ODOO_DB, and ODOO_API_KEY."
        );
      }

      this.config = { url, db, uid, password: apiKey };
    } else if (user && password) {
      const uid = (await call(this.commonClient, "authenticate", [
        db,
        user,
        password,
        {},
      ], this.timeoutMs)) as number;

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
    if (!this.objectClient) {
      this.objectClient = createClient(this.config.url, "/xmlrpc/2/object");
    }
    return this.objectClient;
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
    ], this.timeoutMs);
  }

  async executeMethod(
    model: string,
    method: string,
    ids: number[],
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {}
  ): Promise<unknown> {
    return this.execute(model, method, [ids, ...args], kwargs);
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

  async createBatch(
    model: string,
    valuesList: Record<string, unknown>[]
  ): Promise<number[]> {
    return (await this.execute(model, "create", [valuesList])) as number[];
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

  async readGroup(
    model: string,
    domain: OdooDomain = [],
    fields: string[],
    groupby: string[],
    orderby?: string,
    limit?: number,
    lazy?: boolean
  ): Promise<unknown[]> {
    const kwargs: Record<string, unknown> = {};
    if (orderby) kwargs.orderby = orderby;
    if (limit !== undefined) kwargs.limit = limit;
    if (lazy !== undefined) kwargs.lazy = lazy;

    return (await this.execute(
      model,
      "read_group",
      [domain, fields, groupby],
      kwargs
    )) as unknown[];
  }

  async nameSearch(
    model: string,
    name: string = "",
    domain: unknown[] = [],
    operator: string = "ilike",
    limit: number = 10
  ): Promise<unknown> {
    return this.execute(model, "name_search", [], {
      name,
      args: domain,
      operator,
      limit,
    });
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
