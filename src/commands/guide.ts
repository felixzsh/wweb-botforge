export function runGuide() {
  const guide = `# WWeb BotForge — AI Agent Configuration Guide

Framework for running config-driven WhatsApp bots. All behavior is defined in YAML — no code required.

## Architecture

Three core concepts: **Actions** (what to do), **Flows** (how to respond), **Bots** (who responds).

\`\`\`
WhatsApp message
  -> InboxService (filters: ignored senders, groups, self-messages)
    -> FlowExecutor.handleMessage()
      -> active flow? -> match branch -> transition step -> executeAction()
      -> new message? -> match flow triggers by priority -> enter flow
      -> executeAction()
        -> resolve template variables ({{sender}}, {{message}}, etc.)
        -> check cooldown
        -> enqueue reply -> OutboxService -> WhatsAppChannel.send()
        -> fire webhook -> sendWebhookRequest()
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
  flows/                  # each file = one flow, filename = flow ID
    faq-support.yml
    ping-pong.yml
  bots/                   # each file = one bot, filename = bot ID
    support-bot.yml
    sales-bot.yml
\`\`\`

The loader merges directory files with any inline definitions in \`config.yml\`. Inline definitions take precedence.

### config.yml (only global, no actions/flows/bots inline)

\`\`\`yaml
global:
  chromiumPath: "/usr/bin/chromium"
  apiPort: 3000
  apiEnabled: true
  logLevel: "info"
  sessionTimeout: 300
\`\`\`

---

## Schema Reference

### Global Settings

| Field | Type | Default | Description |
|---|---|---|---|
| chromiumPath | string | - | Path to Chromium/Chrome |
| apiPort | number | 3000 | REST API port |
| apiEnabled | boolean | false | Enable REST API |
| logLevel | string | "info" | info, debug, warn, error |
| sessionTimeout | number | 300 | Default flow session TTL (seconds) |

### Actions

Each action has an ID (the key). Stored in \`actions/<id>.yml\`.

\`\`\`yaml
# Simple reply
reply: "Hello!"

# Reply with webhook
reply: "Processing..."
webhook:
  name: my-webhook
  url: "https://api.example.com/hook"
  method: POST
  headers:
    Authorization: "Bearer token"
  timeout: 10000
  retry: 3

# Cooldown — per-sender rate limiting
cooldown: 120
cooldown_reply: "Please wait {{variables.remaining}} seconds"

# Webhook-only (no reply)
webhook:
  url: "https://crm.example.com/leads"
  method: POST
\`\`\`

| Field | Type | Required | Description |
|---|---|---|---|
| reply | string | no* | Reply text (supports templates) |
| webhook | object | no* | HTTP request config |
| webhook.url | string | yes (if webhook) | Target URL |
| webhook.method | string | "POST" | GET, POST, PUT, PATCH |
| webhook.headers | object | {} | HTTP headers |
| webhook.timeout | number | 5000 | Request timeout (ms) |
| webhook.retry | number | 3 | Retry count |
| cooldown | number | - | Cooldown seconds per sender |
| cooldown_reply | string | - | Message during cooldown |

An action must define \`reply\`, \`webhook\`, or both.

### Flows

Each flow has an ID (the key). Stored in \`flows/<id>.yml\`.

\`\`\`yaml
entry_step: menu
triggers: "menu, hola, hello, hi, help, start"
timeout: 300
fallback_step: invalid
steps:
  menu:
    action: menu
    branches:
      - when: "1, hour, schedule, hours"
        goto: hours
      - when: "2, catalog, products"
        goto: catalog
      - when: "0, exit, bye"
        goto: end
      - goto: invalid
  hours:
    action: hours
    branches:
      - when: "menu, back"
        goto: menu
      - goto: invalid
  end:
    action: farewell
    branches: []
\`\`\`

| Field | Type | Required | Description |
|---|---|---|---|
| entry_step | string | yes | Starting step ID |
| triggers | string, string[], or object[] | no | Entry trigger phrases |
| timeout | number | global default | Session TTL (seconds) |
| fallback_step | string | - | Step for unmatched input |

**Trigger formats:**

\`\`\`yaml
# Comma-separated string
triggers: "menu, help, hi"

# Array of strings
triggers:
  - "menu, help"
  - "start, begin"

# Objects with per-phrase fuzzy threshold
triggers:
  - phrases: "menu, help"
    fuzzy_threshold: 0.3
  - phrases: "start, begin"
    fuzzy_threshold: 0.6
\`\`\`

**Steps:**

| Field | Type | Required | Description |
|---|---|---|---|
| action | string | yes | Action ID to execute |
| branches | array | - | Branch conditions for user input |

**Branches:**

| Field | Type | Description |
|---|---|---|
| when | string or string[] | Comma-separated trigger phrases |
| fuzzy_threshold | number | Fuse.js threshold (0.3=strict, 0.6=moderate default, 0.9=loose) |
| goto | string | **Target step ID** |

- **Default branch**: omit \`when\` to catch unmatched input.
- **Terminal step**: \`branches: []\` ends the session after execution.
- **Branches with no \`when\` at end**: serves as the fallback for unmatched input at that step.

### Bots

Each bot has an ID (the key). Stored in \`bots/<id>.yml\`.

\`\`\`yaml
flows:
  - id: faq-support
    priority: 10
  - id: ping-pong
    priority: 5
settings:
  queue_delay: 1500
  simulate_typing: true
  typing_delay: 1000
  read_receipts: true
  ignore_groups: true
  ignored_senders:
    - "status@broadcast"
  admin_numbers: []
\`\`\`

| Field | Type | Default | Description |
|---|---|---|---|
| flows | array | [] | Flow references with priority |
| flows[].id | string | - | Flow ID to attach |
| flows[].priority | number | 1 | Higher = checked first for trigger matching |
| settings | object | - | Bot behavior |
| settings.queue_delay | number | 1000 | ms between outgoing messages |
| settings.simulate_typing | boolean | true | Show typing indicator |
| settings.typing_delay | number | 1000 | ms for typing simulation |
| settings.read_receipts | boolean | true | Send read receipts |
| settings.ignore_groups | boolean | true | Ignore group messages |
| settings.ignored_senders | string[] | [] | Senders to ignore |
| settings.admin_numbers | string[] | [] | Admin phone numbers |

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
flows: !include flows/main.yml

bots:
  support: !include bots/support.yml
  sales: !include bots/sales.yml
\`\`\`

---

## Best Practices

1. **Use directory-based config** — one file per action/flow/bot instead of one giant \`config.yml\`. File name = ID.
2. **One flow per concern** — keep conversational topics in separate flows (e.g., \`faq-flow\`, \`order-flow\`, \`support-flow\`).
3. **Cooldown on human-escalation actions** — prevent spam-triggering manual agent handoffs.
4. **Terminal steps** — set \`branches: []\` to end sessions cleanly instead of leaving dangling sessions.
5. **Fallback step** — always configure a \`fallback_step\` to handle unexpected user input.
6. **Priority ordering** — more specific flows get higher priority so they're matched first.
7. **Fuzzy thresholds** — \`0.3\` for commands (strict), \`0.6\` default for conversation, \`0.9\` for loose matching.

---

## Complete Modular Example

\`~/.config/wweb-botforge/config.yml\`:

\`\`\`yaml
global:
  chromiumPath: "/usr/bin/chromium"
  apiEnabled: true
  logLevel: "info"
\`\`\`

\`~/.config/wweb-botforge/actions/greet.yml\`:

\`\`\`yaml
reply: "Hev {{senderName}}! How can I help you today?"
\`\`\`

\`~/.config/wweb-botforge/actions/menu.yml\`:

\`\`\`yaml
reply: "Main menu:\\n1. Hours\\n2. Contact\\n0. Exit"
\`\`\`

\`~/.config/wweb-botforge/actions/hours.yml\`:

\`\`\`yaml
reply: "Mon-Fri 9am-6pm"
\`\`\`

\`~/.config/wweb-botforge/actions/farewell.yml\`:

\`\`\`yaml
reply: "Thanks, have a great day!"
\`\`\`

\`~/.config/wweb-botforge/actions/invalid.yml\`:

\`\`\`yaml
reply: "Invalid option. Choose a number from the menu."
\`\`\`

\`~/.config/wweb-botforge/flows/support.yml\`:

\`\`\`yaml
entry_step: greet
triggers: "hello, hi, hey, start, help"
timeout: 300
fallback_step: invalid
steps:
  greet:
    action: greet
    branches:
      - when: "menu, help, continue"
        goto: main_menu
      - goto: invalid
  main_menu:
    action: menu
    branches:
      - when: "1, hours, schedule"
        goto: hours
      - when: "0, exit, bye"
        goto: end
      - goto: invalid
  hours:
    action: hours
    branches:
      - when: "menu, back"
        goto: main_menu
      - when: "0, exit"
        goto: end
      - goto: invalid
  invalid:
    action: invalid
    branches:
      - goto: main_menu
  end:
    action: farewell
    branches: []
\`\`\`

\`~/.config/wweb-botforge/bots/support.yml\`:

\`\`\`yaml
flows:
  - id: support
    priority: 10
settings:
  queue_delay: 1000
  ignore_groups: true
  ignored_senders:
    - "status@broadcast"
\`\`\`

---

## Quick Start CLI Commands

\`\`\`
botforge start                  # Start all bots
botforge start -c path/to.yml  # Start with custom config
botforge create-bot             # Interactive bot creation wizard
botforge setup                  # Setup systemd service
botforge guide                  # Show this guide
\`\`\`
`

  console.log(guide)
}
