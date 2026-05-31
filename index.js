import express from "express";
import { google } from "googleapis";

const app = express();
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const sheets = google.sheets({ version: "v4", auth: oauth2Client });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

app.get("/", (req, res) => res.json({ status: "ok", name: "sheets-mcp" }));
app.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    redirect_uri: process.env.REDIRECT_URI
  });
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send("Нет кода авторизации");
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    res.send(`Авторизация успешна! Refresh token: ${tokens.refresh_token || "уже сохранён"}`);
  } catch (e) {
    res.send("Ошибка: " + e.message);
  }
});
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
});

app.post("/messages", async (req, res) => {
  const { method, params } = req.body;

  if (method === "tools/list") {
    return res.json({ tools: [
      { name: "append_row", description: "Добавить строку в лист", inputSchema: { type: "object", properties: { sheet: { type: "string" }, values: { type: "array" } }, required: ["sheet", "values"] } },
      { name: "update_cell", description: "Обновить ячейку", inputSchema: { type: "object", properties: { sheet: { type: "string" }, cell: { type: "string" }, value: { type: "string" } }, required: ["sheet", "cell", "value"] } },
      { name: "read_sheet", description: "Прочитать лист", inputSchema: { type: "object", properties: { sheet: { type: "string" } }, required: ["sheet"] } }
    ]});
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    try {
      if (name === "append_row") {
        await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `${args.sheet}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [args.values] } });
        return res.json({ content: [{ type: "text", text: "Строка добавлена!" }] });
      }
      if (name === "update_cell") {
        await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${args.sheet}!${args.cell}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[args.value]] } });
        return res.json({ content: [{ type: "text", text: "Ячейка обновлена!" }] });
      }
      if (name === "read_sheet") {
        const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${args.sheet}!A1:Z1000` });
        return res.json({ content: [{ type: "text", text: JSON.stringify(r.data.values) }] });
      }
    } catch (e) {
      return res.json({ error: e.message });
    }
  }

  res.json({});
});

app.listen(3000, () => console.log("MCP server running on port 3000"));
