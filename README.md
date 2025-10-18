# WWeb BotForge

[![npm version](https://badge.fury.io/js/wweb-botforge.svg)](https://badge.fury.io/js/wweb-botforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Create multiple WhatsApp bots without writing code** - Just configure in YAML!

WWeb BotForge lets you create and manage multiple WhatsApp bots by simply editing a configuration file. No programming required! Built on top of [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js).

## ✨ What Can You Do?

- 🤖 **Multiple Bots**: Run several WhatsApp bots from one server
- 📝 **YAML Configuration**: Define bot behavior in simple YAML files
- 💬 **Auto-Responses**: Set up instant replies to common messages
- 🔗 **Webhooks**: Connect to your existing apps in any language.
- 🌐 **REST API**: Send messages programmatically (optional)
- 🚀 **Systemd Service**: Run as a proper system service with auto-restart

## 🚀 Quick Start

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

The `create-bot` command creates a bot entry with default settings but no defined behavior. Your bot won't respond to messages until you configure auto-responses, webhooks, and other settings by editing `~/.config/wweb-botforge/config.yml`. See the Configuration Guide below for detailed instructions on how to add auto-responses, webhooks, and customize your bot's behavior.

### 4. Setup & Start as System Service

```bash
# Start the service
systemctl --user start wweb-botforge

# Enable auto-start on boot
systemctl --user enable wweb-botforge
```

Your bot is now running as a system service! Send messages to test it.

## 🔧 Configuration Guide

### Global Configuration

Configure system-wide settings in the `global` section:

```yaml
global:
  chromiumPath: "/usr/bin/chromium"  # Path to Chromium/Chrome browser
  apiPort: 3000                     # REST API port (optional)
  apiEnabled: true                  # Enable REST API (optional)
  logLevel: "info"                  # Global log level
```

### Bot Structure

Each bot in your `config.yml` can have:

- **`id`**: Unique identifier (auto-generated)
- **`name`**: Display name
- **`phone`**: Phone number (auto-filled after WhatsApp authentication)
- **`auto_responses`**: Instant replies based on message patterns
- **`webhooks`**: HTTP requests to external services
- **`settings`**: Bot behavior options

### Auto-Responses

```yaml
auto_responses:
  - pattern: "your regex pattern"
    response: "Your reply message"
    case_insensitive: true  # optional
    priority: 1            # optional, lower = higher priority
    cooldown: 30           # optional, cooldown in seconds per sender-pattern
```


### Webhooks

Webhooks allow your bot to send HTTP requests to external services when messages match specific patterns. This enables integration with APIs, notification systems, and other services.

**Features:**
- **Outbound HTTP requests**: Bot makes POST/PUT/GET requests to configured URLs
- **Cooldown support**: Same cooldown system as auto-responses
- **Retry logic**: Automatic retries with exponential backoff
- **Custom headers**: Authentication and custom headers
- **Timeout control**: Configurable request timeouts
- **Multiple webhooks**: Multiple webhooks can trigger for the same message

**Configuration:**

```yaml
webhooks:
  - name: "order-webhook"
    pattern: "nuevo pedido|new order"
    url: "https://api.example.com/orders"
    method: "POST"
    headers:
      Authorization: "Bearer your-token"
      Content-Type: "application/json"
    timeout: 5000      # 5 seconds
    retry: 3          # Retry up to 3 times
    priority: 1       # Higher priority = checked first
    cooldown: 60      # 60 seconds cooldown per sender
```

**Webhook Payload:**

When triggered, the webhook sends a JSON payload:

```json
{
  "sender": "521234567890",
  "message": "Tengo un nuevo pedido",
  "timestamp": "2025-01-09T01:45:00Z",
  "botId": "bot-1",
  "botName": "My Bot",
  "webhookName": "order-webhook",
  "webhookPattern": "nuevo pedido|new order",
  "metadata": {}
}
```

### Cooldown Protection

To prevent spam attacks, you can set a `cooldown` (in seconds) for each auto-response or webhook pattern. This creates a cooldown period per sender-pattern combination, preventing the same sender from triggering the same pattern repeatedly within the specified time.

- **Applies to both auto-responses and webhooks**: Works the same way for message replies and HTTP requests
- **Per sender-pattern**: Different senders can trigger the same pattern simultaneously
- **Independent patterns**: A sender can trigger different patterns without waiting
- **Automatic cleanup**: Expired cooldowns are cleaned up automatically to prevent memory leaks

Example with auto-responses:

```yaml
auto_responses:
  - pattern: "help|support"
    response: "How can I help you?"
    cooldown: 60  # 1 minute cooldown per sender for this pattern

  - pattern: "price|cost"
    response: "Check our pricing at example.com/pricing"
    cooldown: 300  # 5 minutes cooldown
```

Example with webhooks:

```yaml
webhooks:
  - name: "order-webhook"
    pattern: "nuevo pedido|new order"
    url: "https://api.example.com/orders"
    method: "POST"
    cooldown: 120  # 2 minutes cooldown per sender for this webhook
```

### Bot Settings

```yaml
settings:
  queue_delay: 1000
  ignore_groups: false
  ignored_senders: []
```

## 🛠️ Service Management

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

## 📖 Examples

### Simple FAQ Bot

```yaml
bots:
  - id: support-bot
    name: "Support Bot"
    auto_responses:
      - pattern: "hours|time"
        response: "We're open Mon-Fri 9am-6pm, Sat 10am-2pm"

      - pattern: "price|cost"
        response: "Check our pricing at website.com/pricing"
```

### Multi-Bot Setup

```yaml
bots:
  - id: sales-bot
    name: "Sales Assistant"
    # ... sales config

  - id: support-bot
    name: "Customer Support"
    # ... support config

  - id: notifications-bot
    name: "Alert Bot"
    # ... notification config
```

## 🤝 Use Cases

- **Customer Support**: Auto-respond to common questions
- **E-commerce**: Handle product inquiries and basic orders
- **Notifications**: Send alerts from your systems
- **Lead Generation**: Capture and route inquiries
- **Internal Tools**: Team communication bots
- **Business Automation**: Streamline repetitive tasks
- **AI Integration**: Connect to ChatGPT, Claude, etc.

### Using Includes

Organize large configs:

```yaml
# config.yml
bots:
  - !include bots/support.yml
  - !include bots/sales.yml
```


## ❓ Troubleshooting

**Service not starting?**
- Check if `xvfb` is installed: `which xvfb`
- Verify config file: `cat ~/.config/wweb-botforge/config.yml`
- Check service logs: `journalctl --user -u wweb-botforge -n 50`

**QR code not showing?**
- Ensure no other WhatsApp sessions are active
- Restart the service: `systemctl --user restart wweb-botforge`

**Messages not responding?**
- Check bot status in logs
- Verify regex patterns in config
- Test with simple messages first

**Webhook not working?**
- Test your endpoint with tools like Postman
- Check logs for timeout/connection errors
- Verify webhook URL and headers

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

This project is built on top of the excellent [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js) library, which provides the core WhatsApp Web automation capabilities. WWeb BotForge wouldn't be possible without this foundational work.

**Made with ❤️ for the no-code bot community**




