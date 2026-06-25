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
- **Actions & Flows**: Build conversation state machines with fuzzy-matched triggers
- **Webhooks**: Connect to your existing apps via HTTP
- **REST API**: Send messages programmatically (optional)
- **Systemd Service**: Run as a proper system service with auto-restart

## Quick Start

### Prerequisites

**System Requirements:**
- **Node.js** 16+ and **npm**
- **Chromium browser** installed on your system
- **For Linux systemd service mode**: `xvfb` (X Virtual Framebuffer) for headless operation


### 1. Install

```bash
npm install -g wweb-botforge
```

### 2. Create Your First Bot

```bash
botforge create-bot
```

Answer the questions:
- **Bot Name**: `My Awesome Bot`

The command will:
- Generate a unique bot ID automatically
- Show a QR code for WhatsApp authentication
- Create the bot configuration with your phone number
- Save everything to `~/.config/wweb-botforge/config.yml`

### 3. Configure Your Bot

The `create-bot` command creates a bot entry with default settings but no defined behavior. Your bot won't respond to messages until you define actions, flows, and assign them to your bot by editing `~/.config/wweb-botforge/config.yml`. See the Configuration Guide below.

### 4. Setup & Start as System Service

```bash
# Start the service
systemctl --user start wweb-botforge

# Enable auto-start on boot
systemctl --user enable wweb-botforge
```

Your bot is now running as a system service! Send messages to test it.

## Configuration Guide

### Global Configuration

Configure system-wide settings at the top level of `config.yml`:

```yaml
chromiumPath: "/usr/bin/chromium"  # Path to Chromium/Chrome browser
apiPort: 3000                     # REST API port (optional)
apiEnabled: true                  # Enable REST API (optional)
logLevel: "info"                  # Global log level
```

### Architecture

BotForge uses three catalogs — **Actions**, **Flows**, and **Bots** — all defined in a single YAML map:

- **Actions**: Reusable behaviors — text replies, webhook calls, cooldowns. Not tied to any specific bot.
- **Flows**: Multi-step conversation state machines that reference actions. Each step has one action and optional branches that transition based on fuzzy-matched user replies.
- **Bots**: WhatsApp numbers that reference flows (by priority) and have per-bot settings.

```
Actions (what to do) → Flows (when and how) → Bots (who does it)
```

### Actions

Actions are the building blocks. Each action can have a `reply` (text response), a `webhook` (HTTP call to external services), and optional `cooldown` / `cooldown_reply`.

Replies support template variables:
- `{{sender}}` — the sender's phone number
- `{{message}}` — the incoming message text
- `{{bot.id}}` — the bot's ID
- `{{variables.name}}` — flow session variables

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

### Flows

Flows define multi-step conversations. Each flow has an `entry_step`, optional `triggers` (comma-separated phrases for fuzzy-matching the user's first message), `steps` with branches, and an optional `fallback_step` for unexpected responses.

```yaml
flows:
  faq-support:
    entry_step: menu
    triggers: "menu, hola, hello, help, start"
    timeout: 300
    fallback_step: invalid
    steps:
      menu:
        action: menu
        branches:
          - when: "1, hours, schedule"
            goto: hours
          - when: "2, catalog, products"
            goto: catalog
          - when: "3, human, agent"
            goto: escalate
          - goto: invalid
      hours:
        action: hours
        branches:
          - when: "menu, back"
            goto: menu
          - goto: invalid
      end:
        action: farewell
        branches: []           # empty = terminal step, session ends

  ping-pong:
    entry_step: ping
    triggers: "ping"
    steps:
      ping:
        action: pong
        branches: []
```

- **`triggers`** — comma-separated phrases. Fuzzy-matched against incoming messages to enter the flow.
- **`fuzzy_threshold`** — controls strictness. `0.3` = strict, `0.6` = moderate (default), `0.9` = loose.
- **`timeout`** — seconds of inactivity before the session expires. Defaults to global `sessionTimeout`.
- **`fallback_step`** — where to redirect if no branch matches. Without one, mismatched messages are silently ignored.
- **`branches: []`** — empty branches mean the flow ends after that step (terminal).

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

### Bot Settings

```yaml
settings:
  queue_delay: 1000        # ms between outgoing messages
  simulate_typing: true    # show typing indicator before replies
  typing_delay: 1000       # ms to simulate typing before sending
  read_receipts: true      # mark messages as read
  ignore_groups: true      # skip group messages
  ignored_senders:         # skip messages from these senders
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
- Verify flow triggers are correctly set in config
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

