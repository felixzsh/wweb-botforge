# WWeb BotForge

[![npm version](https://badge.fury.io/js/wa-botforge.svg)](https://badge.fury.io/js/wa-botforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Create powerful WhatsApp bots with YAML configuration!**

## 🎯 Why WWeb BotForge?

WWeb BotForge is built on top of the amazing [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js) library, which provides granular control over WhatsApp Web automation. While WhatsApp Web JS is a powerful API for automating WhatsApp Web clients, WWeb BotForge specifically abstracts the creation of bots that:

- **Capture incoming messages** and automatically respond
- **Delegate message handling** to external software
- **Simplify bot creation** through YAML configuration

This project enables direct management of WhatsApp bots through YAML configuration, focusing on automated responses and message processing, without being limited to a single programming language.

**Current Focus**: Auto-responses with regex patterns and message queues  
**Coming Soon**: Webhooks and REST API for advanced integrations

## ✨ What Can You Do?

- 🤖 **Multiple Bots**: Run several WhatsApp bots from one server
- 📝 **YAML Configuration**: Define bot behavior in simple YAML files
- 📱 **Auto-Responses**: Set up instant replies to common messages
- 🚀 **Quick Setup**: Get your first bot running in minutes

## 🚀 Quick Start (5 minutes!)

### 1. Install

```bash
npm install -g wa-botforge
```

### 2. Create Your First Bot

```bash
npx wa-botforge create-bot
```

Answer the questions:
- **Bot Name**: `My Awesome Bot`

The command will:
- Generate a unique bot ID automatically
- Show a QR code for WhatsApp authentication
- Create the bot configuration with your phone number
- Save everything to `config/main.yml`

### 3. Configure Auto-Responses (Optional)

Edit `config/main.yml` to add more auto-responses:

```yaml
bots:
  - id: bot-abc123  # Auto-generated
    name: "My Awesome Bot"
    phone: "+1234567890"  # Auto-filled
    auto_responses:
      - pattern: "\\b(hello|hi|hey)\\b"
        response: "Hello! How can I help you today?"
        case_insensitive: true

      - pattern: "\\b(bye|goodbye)\\b"
        response: "Goodbye! Have a great day! 👋"
```

### 4. Start Your Bot

```bash
wa-botforge start
```

Your bot is now running with auto-responses! Send messages to test it.

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

## 🔧 Configuration Guide

### Bot Structure

Each bot in your `main.yml` can have:

- **`id`**: Unique identifier (auto-generated from bot name)
- **`name`**: Display name
- **`phone`**: Phone number (auto-filled after WhatsApp authentication)
- **`auto_responses`**: Instant replies based on message patterns
- **`settings`**: Bot behavior options (delays, filters, etc.)

### Auto-Responses

```yaml
auto_responses:
  - pattern: "your regex pattern"
    response: "Your reply message"
    case_insensitive: true  # optional
    priority: 1            # optional, lower = higher priority
```

For advanced usage, you can include `response_options` to access WhatsApp Web's [Message Send Options](https://docs.wwebjs.dev/global.html#MessageSendOptions) like link previews, media handling, and more (all optional).

Example with media:

```yaml
auto_responses:
  - pattern: "image|photo"
    response: "Here's an image:"
    response_options:
      media: "https://example.com/image.jpg"
      caption: "Check this out!"
```

### Settings

```yaml
settings:
  simulate_typing: true
  typing_delay: 1000
  read_receipts: true
  ignore_groups: false
  admin_numbers:
    - "+1234567890"
  log_level: "info"
```

## 🚀 Roadmap

### ✅ **Already Implemented**
- YAML configuration loading
- Basic auto-responses with regex patterns
- Message queues with configurable delays (in validation)

### 🔄 **Coming Soon**
- Webhooks for advanced integrations
- REST API for external message sending
- Distribution as ready-to-use service
- Web management interface

## 🤝 Use Cases

### Using Includes

Organize large configs:

```yaml
# main.yml
bots:
  - !include bots/support.yml
  - !include bots/sales.yml
```

- **Customer Support**: Auto-respond to common questions
- **E-commerce**: Handle product inquiries and basic orders
- **Notifications**: Send alerts from your systems
- **Lead Generation**: Capture and route inquiries
- **Internal Tools**: Team communication bots
- **Business Automation**: Streamline repetitive tasks


## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

This project is built on top of the excellent [WhatsApp Web JS](https://github.com/pedroslopez/whatsapp-web.js) library, which provides the core WhatsApp Web automation capabilities. WA BotForge wouldn't be possible without this foundational work.

**Made with ❤️ for the bot automation community**



