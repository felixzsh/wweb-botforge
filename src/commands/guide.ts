export function runGuide() {
  const guide = `# WWeb BotForge — AI Agent Configuration Guide

Framework for running config-driven WhatsApp bots. All behavior is defined in YAML — no code required.

## Architecture

Three core concepts: **Actions** (what to do), **Graphs** (how to respond), **Bots** (who responds).

\`\`\`
Bot
  └─ Graph (one per bot)
       └─ Nodes
            └─ Edges (transitions based on fuzzy-matched user input)
                 └─ Actions
\`\`\`

A bot owns exactly one graph. A graph represents the complete conversation for that bot. Nodes belong to their graph and are not reusable across graphs. Actions remain globally reusable.

\`\`\`
WhatsApp message
  -> InboxService (filters: ignored senders, groups, self-messages)
    -> GraphExecutor.handleMessage()
      -> active session? -> match edge from current/visited nodes -> transition -> executeAction()
      -> new sender?     -> create session at root, execute root action, then re-resolve the original message
                            against the root edges (and any visited nodes)
      -> executeAction()
        -> resolve template variables ({{sender}}, {{message}}, etc.)
        -> check cooldown
        -> enqueue reply -> OutboxService -> WhatsAppChannel.send()
        -> fire request -> sendRequestRequest()
\`\`\`

---

## Modular Configuration (Recommended)

Place config files in a directory structure. File names become IDs.

\`\`\`
~/.config/wweb-botforge/
  config.yml              # global settings only
  actions/                # each file = one action, filename = action ID
    greet.yml
    menu.yml
    escalate.yml
  graphs/                 # each file = one graph, filename = graph ID
    support.yml
    ping-pong.yml
  bots/                   # each file = one bot, filename = bot ID
    support-bot.yml
    sales-bot.yml
\`\`\`

The loader merges directory files with any inline definitions in \`config.yml\`. Inline definitions take precedence.

### config.yml (global settings only, actions/graphs/bots are separate files)

\`\`\`yaml
chromium_path: "/usr/bin/chromium"
api_port: 3000
log_level: "info"
default_timeout: 300
\`\`\`

---

## Schema Reference

### Global Settings

| Field | Type | Default | Description |
|---|---|---|---|---|
| chromium_path | string | - | Path to Chromium/Chrome |
| api_port | number | 3000 | REST API port (if set, API runs on this port) |
| api_key | string | - | REST API key (optional — if set, all /api/* requests require \`Authorization: Bearer <key>\`) |
| log_level | string | "info" | info, debug, warn, error |
| default_timeout | number | 300 | Default graph session TTL (seconds) |

### Actions

Each action has an ID (the key). Stored in \`actions/<id>.yml\`. An action is a **pipeline of ordered steps** with optional **guards** for rate limiting.

\`\`\`yaml
# Simple message step
steps:
  - message:
      body: "Hello!"

# Pipeline: message + request
steps:
  - message:
      body: "Processing..."
  - request:
      name: my-request
      url: "https://api.example.com/hook"
      method: POST
      headers:
        Authorization: "Bearer token"
      timeout: 10000
      retry: 3

# Cooldown guard — per-sender rate limiting
guards:
  cooldown:
    duration: 120
    on_blocked:
      - message:
          body: "Please wait before requesting again."
steps:
  - message:
      body: "Processing request..."

# Request-only (no message)
steps:
  - request:
      url: "https://crm.example.com/leads"
      method: POST
\`\`\`

**Step types:**

| Step | Field | Type | Required | Description |
|---|---|---|---|---|
| message | body | string | yes | Message body (supports templates) |
| message | to | string | no | Recipient override (default = sender) |
| request | url | string | yes | Target URL |
| request | method | string | "POST" | GET, POST, PUT, PATCH |
| request | headers | object | {} | HTTP headers |
| request | timeout | number | 5000 | Request timeout (ms) |
| request | retry | number | 3 | Retry count |
| location | latitude | number | yes | -90 to 90 |
| location | longitude | number | yes | -180 to 180 |
| location | name | string | no | Location name |
| location | address | string | no | Location address |

**Guards:**

| Guard | Field | Type | Required | Description |
|---|---|---|---|---|
| cooldown | duration | number | yes | Cooldown seconds per sender |
| cooldown | on_blocked | array | no | Pipeline to run when blocked |

An action must define \`steps\` (at least one) or a \`cooldown\` guard with \`on_blocked\`.

### Graphs

Each graph has an ID (the key). Stored in \`graphs/<id>.yml\`.

\`\`\`yaml
root: menu
timeout: 300
fallback: invalid
nodes:
  menu:
    action: menu
    edges:
      - match: "1, hour, schedule, hours"
        goto: hours
      - match: "2, catalog, products"
        goto: catalog
      - match: "0, exit, bye"
        goto: end
      - goto: invalid
  hours:
    action: hours
    edges:
      - match: "menu, back"
        goto: menu
      - goto: invalid
  end:
    action: farewell
    edges: []
\`\`\`

| Field | Type | Required | Description |
|---|---|---|---|
| root | string | yes | Starting node ID |
| timeout | number | global default | Session TTL (seconds) |
| fallback | string | - | Node for unmatched input |

Graphs have **no entry triggers**. When a sender has no active session, the bot automatically creates a session at \`root\`, executes the root action, and then re-applies the original message against the root's edges.

**Nodes:**

| Field | Type | Required | Description |
|---|---|---|---|
| action | string | yes | Action ID to execute |
| edges | array | - | Edge conditions for user input |

**Edges:**

| Field | Type | Description |
|---|---|---|
| match | string or string[] | Comma-separated fuzzy-matched phrases |
| fuzzy_threshold | number | Fuse.js threshold (0.3=strict, 0.6=moderate default, 0.9=loose) |
| goto | string | **Target node ID** |

- **Default edge**: omit \`match\` to catch unmatched input.
- **No edges (\`edges: []\`)**: session stays alive; the user can still navigate via edges from any previously visited node. Sessions only end via timeout.

### Bots

Each bot has an ID (the key). Stored in \`bots/<id>.yml\`.

\`\`\`yaml
graph: support
settings:
  queue_delay: 1500
  ignore_groups: true
  ignored_senders:
    - "status@broadcast"
  admin_numbers: []
\`\`\`

| Field | Type | Default | Description |
|---|---|---|---|
| graph | string | - | Graph ID this bot owns |
| settings | object | - | Bot behavior |
| settings.queue_delay | number | 1000 | ms between outgoing messages |
| settings.ignore_groups | boolean | true | Ignore group messages |
| settings.ignored_senders | string[] | [] | Senders to ignore |
| settings.admin_numbers | string[] | [] | Admin phone numbers |

A bot references exactly one graph. There is no priority or list of graphs per bot.

---

## Template Variables

Action replies support variable interpolation:

| Variable | Description |
|---|---|
| \`{{sender}}\` | Sender phone number |
| \`{{senderName}}\` | Sender pushname (if available) |
| \`{{message}}\` | Raw message body |
| \`{{bot.id}}\` | Bot ID |
| \`{{variables.remaining}}\` | Cooldown remaining seconds |

---

## !include Directive

Explicit file inclusion from within \`config.yml\`:

\`\`\`yaml
actions: !include actions/main.yml
graphs: !include graphs/main.yml

bots:
  support: !include bots/support.yml
  sales: !include bots/sales.yml
\`\`\`

---

## Best Practices

1. **Use directory-based config** — one file per action/graph/bot instead of one giant \`config.yml\`. File name = ID.
2. **One graph per bot** — keep the whole conversation for a single bot inside one graph.
3. **Cooldown on human-escalation actions** — prevent spam-triggering manual agent handoffs.
4. **Use edges: [] for end-of-conversation nodes** — sessions will still expire on timeout, but a user can still reach previously visited nodes.
5. **Fallback node** — always configure a \`fallback\` to handle unexpected user input.
6. **Fuzzy thresholds** — \`0.3\` for commands (strict), \`0.6\` default for conversation, \`0.9\` for loose matching.

---

## Complete Modular Example

\`~/.config/wweb-botforge/config.yml\`:

\`\`\`yaml
chromium_path: "/usr/bin/chromium"
log_level: "info"
\`\`\`

\`~/.config/wweb-botforge/actions/greet.yml\`:

\`\`\`yaml
steps:
  - message:
      body: "Hev {{senderName}}! How can I help you today?"
\`\`\`

\`~/.config/wweb-botforge/actions/menu.yml\`:

\`\`\`yaml
steps:
  - message:
      body: "Main menu:\\n1. Hours\\n2. Contact\\n0. Exit"
\`\`\`

\`~/.config/wweb-botforge/actions/hours.yml\`:

\`\`\`yaml
steps:
  - message:
      body: "Mon-Fri 9am-6pm"
\`\`\`

\`~/.config/wweb-botforge/actions/farewell.yml\`:

\`\`\`yaml
steps:
  - message:
      body: "Thanks, have a great day!"
\`\`\`

\`~/.config/wweb-botforge/actions/invalid.yml\`:

\`\`\`yaml
steps:
  - message:
      body: "Invalid option. Choose a number from the menu."
\`\`\`

\`~/.config/wweb-botforge/graphs/support.yml\`:

\`\`\`yaml
root: greet
timeout: 300
fallback: invalid
nodes:
  greet:
    action: greet
    edges:
      - match: "menu, help, continue"
        goto: main_menu
      - goto: invalid
  main_menu:
    action: menu
    edges:
      - match: "1, hours, schedule"
        goto: hours
      - match: "0, exit, bye"
        goto: farewell
      - goto: invalid
  hours:
    action: hours
    edges:
      - match: "menu, back"
        goto: main_menu
      - match: "0, exit"
        goto: farewell
      - goto: invalid
  invalid:
    action: invalid
    edges:
      - goto: main_menu
  farewell:
    action: farewell
    edges: []
\`\`\`

\`~/.config/wweb-botforge/bots/support.yml\`:

\`\`\`yaml
graph: support
settings:
  queue_delay: 1000
  ignore_groups: true
  ignored_senders:
    - "status@broadcast"
\`\`\`

---

## REST API Reference

When \`api_port\` is set in config, the daemon starts an HTTP API at \`http://localhost:<api_port>\`.

### Authentication

If \`api_key\` is configured in \`config.yml\`, every \`/api/*\` request (except \`/api/health\`) must include:

\`\`\`
Authorization: Bearer <api_key>
\`\`\`

If \`api_key\` is not set, the API is open (suitable for localhost-only or reverse-proxy-controlled setups).

### Endpoints

#### GET /api/health

Liveness probe. Always responds without authentication.

\`\`\`json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z", "service": "WWeb BotForge API" }
\`\`\`

#### GET /api/status

Detailed status of all bots with session state.

\`\`\`bash
curl http://localhost:3000/api/status
\`\`\`

\`\`\`json
{
  "running": true,
  "bots": [
    {
      "id": "support-bot",
      "graph": "faq-support",
      "phone": "521234567890@c.us",
      "session": { "state": "connected", "lastQR": false, "error": null }
    }
  ],
  "total": 1
}
\`\`\`

#### GET /api/bots

List all bots with their configuration.

\`\`\`bash
curl http://localhost:3000/api/bots
\`\`\`

\`\`\`json
{ "bots": [{ "id": "support-bot", "phone": "...", "graph": "faq-support", "settings": {} }], "total": 1 }
\`\`\`

#### GET /api/bots/:botId

Single bot info.

\`\`\`bash
curl http://localhost:3000/api/bots/support-bot
\`\`\`

#### POST /api/messages/send

Enqueue an outgoing WhatsApp message.

\`\`\`bash
curl -X POST http://localhost:3000/api/messages/send \\
  -H 'Content-Type: application/json' \\
  -d '{"botId": "support-bot", "to": "521234567890@c.us", "content": "Hello from the API!", "metadata": {"source": "webhook"}}'
\`\`\`

\`\`\`json
{ "success": true, "messageId": "uuid", "botId": "support-bot", "queued": true }
\`\`\`

| Field | Type | Required | Description |
|---|---|---|---|
| botId | string | yes | Bot ID to send from |
| to | string | yes | Recipient WhatsApp ID (number@c.us) |
| content | string | yes | Message body (supports templates) |
| metadata | object | no | Arbitrary metadata attached to the message |

#### GET /api/messages/queue

All message queues status.

\`\`\`bash
curl http://localhost:3000/api/messages/queue
\`\`\`

#### GET /api/messages/queue/:botId

Per-bot queue status.

\`\`\`bash
curl http://localhost:3000/api/messages/queue/support-bot
\`\`\`

#### GET /api/sessions

List all registered WhatsApp sessions.

\`\`\`bash
curl http://localhost:3000/api/sessions
\`\`\`

#### POST /api/sessions/:id

Register/initiate a WhatsApp session. If the session already exists and is pending, returns current state. If already connected, returns 409.

\`\`\`bash
curl -X POST http://localhost:3000/api/sessions/support-bot
\`\`\`

\`\`\`json
{ "success": true, "id": "support-bot", "session": { "state": "pending" } }
\`\`\`

#### GET /api/sessions/:id

Get session info by bot ID.

\`\`\`bash
curl http://localhost:3000/api/sessions/support-bot
\`\`\`

#### DELETE /api/sessions/:id

Remove/disconnect a WhatsApp session.

\`\`\`bash
curl -X DELETE http://localhost:3000/api/sessions/support-bot
\`\`\`

#### GET /api/sessions/:id/events

Server-Sent Events (SSE) stream for session lifecycle. Useful for QR authentication programmatically.

\`\`\`bash
curl -N http://localhost:3000/api/sessions/support-bot/events
\`\`\`

Events:

| event type | data | description |
|---|---|---|
| \`qr\` | \`{ "qr": "base64..." }\` | QR code for authentication |
| \`ready\` | \`{ "phone": "521234567890@c.us" }\` | Session connected |
| \`auth_failure\` | \`{ "error": "..." }\` | Authentication failed |
| \`disconnected\` | \`{}\` | Session disconnected |

#### POST /api/config/reload

Trigger a hot reload of the configuration from disk.

\`\`\`bash
curl -X POST http://localhost:3000/api/config/reload
\`\`\`

#### GET /api/config/status

Check if the config file watcher is active.

\`\`\`bash
curl http://localhost:3000/api/config/status
\`\`\`

\`\`\`json
{ "watching": true }
\`\`\`

---

## Quick Start CLI Commands

\`\`\`
botforge daemon                 # Start the bot daemon
botforge status                 # Show bot session status
botforge auth <botId>           # Authenticate a bot
botforge setup                  # Setup systemd service
botforge guide                  # Show this guide
\`\`\`
`

  console.log(guide)
}
