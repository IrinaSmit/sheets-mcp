import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const sheets = google.sheets({ version: "v4", auth: oauth2Client });

const server = new Server({ name: "sheets-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "append_row",
      description: "Добавить строку в лист Google Sheets",
      inputSchema: {
        type: "object",
        properties: {
          sheet: { type: "string", description: "Название листа" },
          values: { type: "array", description: "Массив значений" }
        },
        required: ["sheet", "values"]
      }
    },
    {
      name: "update_cell",
      description: "Обновить ячейку в Google Sheets",
      inputSchema: {
        type: "object",
        properties: {
          sheet: { type: "string" },
          cell: { type: "string", description: "Например A2" },
          value: { type: "string" }
        },
        required: ["sheet", "cell", "value"]
      }
    },
    {
      name: "read_sheet",
      description: "Прочитать данные листа",
      inputSchema: {
        type: "object",
        properties: {
          sheet: { type: "string" },
          range: { type: "string", description: "Например A1:Z100" }
        },
        required: ["sheet"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "append_row") {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${args.sheet}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [args.values] }
    });
    return { content: [{ type: "text", text: "Строка добавлена!" }] };
  }

  if (name === "update_cell") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${args.sheet}!${args.cell}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[args.value]] }
    });
    return { content: [{ type: "text", text: "Ячейка обновлена!" }] };
  }

  if (name === "read_sheet") {
    const range = args.range || "A1:Z1000";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${args.sheet}!${range}`
    });
    return { content: [{ type: "text", text: JSON.stringify(res.data.values) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
