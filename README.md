# WWeb BotForge

[![npm version](https://img.shields.io/npm/v/wweb-botforge.svg)](https://www.npmjs.com/package/wweb-botforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/felixzsh/wweb-botforge/pulls)

**Create multiple WhatsApp bots without writing code** - Just configure in YAML!

WWeb BotForge lets you create and manage multiple WhatsApp bots by simply editing a configuration file. No programming required! Built on top of [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js).

## What Can You Do?

- **Multiple Bots**: Run several WhatsApp bots from one server
- **YAML Configuration**: Define bot behavior in simple YAML files
- **Actions & Graphs**: Build conversation state machines with fuzzy-matched edges
- **Webhooks**: Connect to your existing apps via HTTP
- **REST API**: Send messages programmatically (optional)
- **Systemd Service**: Run as a proper system service with auto-restart

## Quick Start

### Prerequisites

**System Requirements:**
- **Node.js** 22.13+ and **npm/pnpm**
- **Chromium browser** installed on your system
- **For Linux systemd service mode**: `xvfb` (X Virtual Framebuffer) for headless operation


### 1. Install

```bash
npm install -g wweb-botforge
```

### 2. Setup & Start as System Service

The daemon is configured automatically during install. Start it with:

```bash
# Start the service
systemctl --user start wweb-botforge

# Enable auto-start on boot
systemctl --user enable wweb-botforge
```

### 3. Authenticate Your Bot

```bash
botforge auth <botId>
```

Shows a QR code to link your WhatsApp account. Once scanned, the bot is authenticated and ready.

### 4. Check Status

```bash
botforge status
journalctl --user -u wweb-botforge -f    # real-time logs
```

## Configuration Guide

### Global Configuration

Configure system-wide settings at the top level of `config.yml`:

```yaml
chromium_path: "/usr/bin/chromium"  # Path to Chromium/Chrome browser
api_port: 3000                     # REST API port (optional)
api_enabled: true                  # Enable REST API (optional)
log_level: "info"                  # Global log level
session_timeout: 300               # Global default timeout for graph sessions (seconds)
```

### Architecture

BotForge uses three catalogs — **Actions**, **Graphs**, and **Bots** — all defined in a single YAML map:

- **Actions**: Reusable behaviors — text replies, webhook calls, cooldowns. Not tied to any specific bot.
- **Graphs**: Conversation state machines. A graph owns a set of nodes connected by fuzzy-matched edges. Each bot references exactly one graph.
- **Bots**: WhatsApp numbers that reference a single graph and have per-bot settings.

```
Bot
  └─ Graph (one per bot)
       └─ Nodes
            └─ Edges (transitions based on fuzzy-matched user input)
                 └─ Actions
```

### Actions

Actions are the building blocks. Each action can have a `reply` (text response), a `webhook` (HTTP call to external services), and optional `cooldown` / `cooldown_reply`.

Replies support template variables:
- `{{sender}}` — the sender's phone number
- `{{message}}` — the incoming message text
- `{{bot.id}}` — the bot's ID
- `{{variables.name}}` — graph session variables

```yaml
actions:
  greet:
    reply: "Hello! How can I help you?"

  escalate:
    reply: "Connecting you to a human agent."
    webhook:
      name: escalate-human
      url: "https://api.example.com/support/escalate"
      method: POST
      headers:
        Authorization: "Bearer your-api-token"
      timeout: 10000
      retry: 3
    cooldown: 120
    cooldown_reply: "You already requested a human agent. Please wait."

  lead-notify:
    webhook:
      name: lead-capture
      url: "https://crm.example.com/leads"
      method: POST
      headers:
        X-API-Key: "your-crm-key"

  # Send a WhatsApp location pin (combined with a text reply)
  send-office:
    reply: "Here is our office."
    location:
      latitude: 19.4326
      longitude: -99.1332
      name: "Main Office"
      address: "Av. Reforma 123, CDMX"
      url: "https://maps.example.com/office"
      description: "Open Mon-Fri 9-18h"

  # Location-only action (no text reply)
  send-store-only:
    location:
      latitude: 19.4326
      longitude: -99.1332
      name: "Store"
```

When a webhook fires, it sends a JSON payload:

```json
{
  "sender": "521234567890",
  "message": "I'm interested in your product",
  "timestamp": "2025-01-09T01:45:00Z",
  "botId": "support-bot",
  "botName": "support-bot",
  "webhookName": "lead-capture",
  "metadata": {}
}
```

### Graphs

Graphs define multi-step conversations. Each graph has a `root` node, optional `timeout`, optional `fallback_node` for unmatched input, and a map of `nodes` connected by `edges`.

```yaml
graphs:
  faq-support:
    root: menu
    timeout: 300                   # Session TTL (seconds) — session dies after inactivity
    fallback_node: invalid         # Where to go if user sends an unexpected response
    nodes:
      menu:
        action: menu
        edges:
          - match: "1, hours, schedule, time, hours"
            goto: hours
          - match: "2, catalog, product, brochure"
            goto: catalog
          - match: "3, human, agent, person, talk, speak"
            goto: escalate
          - match: "4, price, pricing, cost"
            goto: pricing
          - match: "0, exit, bye, goodbye, end"
            goto: farewell
          - goto: invalid           # Default edge (no 'match'): catches everything else

      hours:
        action: hours
        edges:
          - match: "menu, back, return, volver"
            goto: menu
          - match: "0, exit"
            goto: farewell
          - goto: invalid

      catalog:
        action: catalog
        edges:
          - match: "menu, back"
            goto: menu
          - match: "0, exit"
            goto: farewell
          - goto: invalid

      escalate:
        action: escalate            # This action has cooldown
        edges:
          - match: "menu, back"
            goto: menu
          - match: "0, exit"
            goto: farewell
          - goto: invalid

      pricing:
        action: pricing
        edges:
          - match: "menu, back"
            goto: menu
          - match: "0, exit"
            goto: farewell
          - match: "interested, buy, order, quote"
            goto: lead
          - goto: invalid

      lead:
        action: lead-notify
        edges:
          - match: "menu, back"
            goto: menu
          - goto: farewell

      invalid:
        action: invalid
        edges:
          - goto: menu               # Always return to menu after invalid input

      farewell:
        action: farewell
        edges: []                    # No edges — session stays alive until timeout
```

**Graph entry behavior:**

When a sender has no active session, the bot automatically:
1. Creates a new session
2. Enters the graph's `root` node
3. Executes the root node's action
4. Stores the root node in the visited history
5. Attempts to resolve the user's original message using the normal node resolution algorithm

This means the user's first message is never discarded — it can match a root edge and transition to a different node right away.

- **`match`** — comma-separated phrases. Fuzzy-matched against the user's message with the configured threshold.
- **`fuzzy_threshold`** — controls strictness. `0.3` = strict, `0.6` = moderate (default), `0.9` = loose.
- **`timeout`** — seconds of inactivity before the session expires. Defaults to global `session_timeout`.
- **`fallback_node`** — where to redirect if no edge matches. Without one, mismatched messages are silently ignored.
- **`edges: []`** — a node with no edges does not destroy the session; the user can still navigate to any previously visited node from its own edges. Sessions only end via timeout.

### Cooldowns

Set a `cooldown` (seconds) on any action to prevent the same sender from triggering it repeatedly. Optionally provide a `cooldown_reply` that gets sent instead of the normal reply during the cooldown period.

```yaml
actions:
  escalate:
    reply: "Connecting you to an agent."
    webhook:
      name: escalate-human
      url: "https://api.example.com/support/escalate"
    cooldown: 120
    cooldown_reply: "You already requested an agent. Please wait."
```

Cooldowns are per-sender, per-action — different senders are tracked independently.

### Location Actions

Send a WhatsApp location pin to the user. An action may be `location`-only or combined with `reply`/`webhook`.

```yaml
actions:
  send-office:
    reply: "Here is our office."
    location:
      latitude: 19.4326
      longitude: -99.1332
      name: "Main Office"
      address: "Av. Reforma 123, CDMX"
```

Required: `latitude` (-90 to 90), `longitude` (-180 to 180). Optional: `name`, `address`, `url`, `description`.

### Bot Settings

A bot references exactly one graph.

```yaml
bots:
  support-bot:
    graph: faq-support
    settings:
      queue_delay: 1500
      simulate_typing: true
      typing_delay: 1000
      read_receipts: true
      ignore_groups: true
      ignored_senders:
        - "status@broadcast"
```

See [`config.example.yml`](config.example.yml) for a full working configuration.

## Service Management

Once installed and configured, manage your bot service:

```bash
# Check service status
systemctl --user status wweb-botforge

# View logs in real-time
journalctl --user -u wweb-botforge -f

# Restart service
systemctl --user restart wweb-botforge

# Stop service
systemctl --user stop wweb-botforge

# Disable auto-start
systemctl --user disable wweb-botforge
```

## Troubleshooting

**Service not starting?**
- Check if `xvfb` is installed: `which xvfb`
- Verify config file: `cat ~/.config/wweb-botforge/config.yml`
- Check service logs: `journalctl --user -u wweb-botforge -n 50`

**QR code not showing?**
- Ensure no other WhatsApp sessions are active
- Restart the service: `systemctl --user restart wweb-botforge`

**Messages not responding?**
- Check bot status in logs
- Verify the bot's `graph` field references an existing graph
- Test with exact phrases first, then tune `fuzzy_threshold`

**Webhook not working?**
- Test your endpoint with tools like Postman
- Check logs for timeout/connection errors
- Verify webhook URL and headers

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Acknowledgments

This project is built on top of the excellent [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js) library, which provides the core WhatsApp Web automation capabilities. WWeb BotForge wouldn't be possible without this foundational work.
