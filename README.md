# odoo-mcp

MCP (Model Context Protocol) server for Odoo ERP. Connect any AI assistant to your Odoo instance using standard XML-RPC — **no addons, no YOLO mode, no hassle**.

## ✨ Highlights

- **No addon required** — uses Odoo's built-in XML-RPC API
- **No YOLO mode** — proper API Key or user/password authentication
- **TypeScript** — fully typed, reliable
- **Zero config** — run with `npx odoo-mcp`, configure via environment variables
- **Odoo 14+** — works with any Odoo version that supports XML-RPC

## Quick Start

### 1. Get your Odoo API Key

Go to **Settings → Users → Your User → Preferences → Account Security → API Keys** and generate one.

### 2. Configure your MCP client

Add to your MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["-y", "odoo-mcp"],
      "env": {
        "ODOO_URL": "https://your-odoo.com",
        "ODOO_DB": "your-db",
        "ODOO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 3. Start asking questions

> "Show me all open sales orders"
> "Create a new contact named John Doe with email john@example.com"
> "How many invoices were created this month?"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ODOO_URL` | ✅ | Odoo instance URL (e.g., `https://your-odoo.com`) |
| `ODOO_DB` | ✅ | Database name |
| `ODOO_API_KEY` | ✅* | API Key for authentication |
| `ODOO_USER` | ✅* | User email (when using user/password auth) |
| `ODOO_PASSWORD` | ✅* | Password (when using user/password auth) |

\* Either `ODOO_API_KEY` or both `ODOO_USER` + `ODOO_PASSWORD` are required.

## Tools

| Tool | Description |
|------|-------------|
| `search_records` | Search records with domain filters, field selection, pagination, and sorting |
| `read_record` | Read specific records by ID |
| `create_record` | Create a new record |
| `update_record` | Update existing records |
| `delete_record` | Delete records |
| `count_records` | Count records matching a domain filter |
| `list_models` | List all available Odoo models |
| `get_fields` | Get field definitions for a model |

### Examples

**Search records:**
```
model: "res.partner"
domain: '[["is_company","=",true]]'
fields: "name,email,phone"
limit: 10
```

**Create a record:**
```
model: "res.partner"
values: '{"name":"John Doe","email":"john@example.com","is_company":false}'
```

**Get field info:**
```
model: "sale.order"
attributes: "string,type,required"
```

## Authentication

### API Key (Recommended)

1. Log in to your Odoo instance
2. Go to **Settings → Users & Companies → Users**
3. Select your user → **Preferences** tab
4. Under **Account Security**, click **New API Key**
5. Copy the key and set it as `ODOO_API_KEY`

### User/Password

Set `ODOO_USER` (email) and `ODOO_PASSWORD` instead of `ODOO_API_KEY`. This is less secure and not recommended for production.

## Development

```bash
git clone https://github.com/intellieffect/odoo-mcp.git
cd odoo-mcp
npm install
npm run build
```

Test locally:

```bash
ODOO_URL=https://your-odoo.com ODOO_DB=your-db ODOO_API_KEY=your-key node dist/index.js
```

## License

MIT
