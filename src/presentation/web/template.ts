export function pageTemplate(content: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Steam Inventory Viewer</title>
  <style>
    body { font-family: sans-serif; margin: 24px; }
    form { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 8px; margin-bottom: 16px; }
    input, button { padding: 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>Steam Inventory Viewer</h1>
  <form method="get" action="/inventory">
    <input name="steamId" placeholder="SteamID64" required />
    <input name="appId" placeholder="App ID" value="730" required />
    <input name="contextId" placeholder="Context ID" value="2" required />
    <button type="submit">Load</button>
  </form>
  ${content}
</body>
</html>`;
}
