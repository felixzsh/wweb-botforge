# WhatsApp BotForge

[![npm version](https://badge.fury.io/js/whatsapp-botforge.svg)](https://badge.fury.io/js/whatsapp-botforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Create multiple WhatsApp bots without writing code** - Just configure in YAML!

WhatsApp BotForge lets you create and manage multiple WhatsApp bots by simply editing a configuration file. No programming required!

## ✨ What Can You Do?

- 🤖 **Multiple Bots**: Run several WhatsApp bots from one server
- 📝 **YAML Configuration**: Define bot behavior in simple YAML files
- 🔗 **Webhooks**: Connect to your existing apps (Python, PHP, Node.js, etc.)
- 📱 **Auto-Responses**: Set up instant replies to common messages
- 🚀 **Quick Setup**: Get your first bot running in minutes
- 🌐 **REST API**: Send messages programmatically

## 🚀 Quick Start (5 minutes!)

### 1. Install

```bash
npm install -g whatsapp-botforge
# or for local development
git clone https://github.com/yourusername/whatsapp-botforge.git
cd whatsapp-botforge
pnpm install
```

### 2. Create Your First Bot

```bash
npx botforge create-bot
```

Answer the questions:
- **Bot ID**: `my-first-bot`
- **Bot Name**: `My Awesome Bot`
- **Webhook URL**: (leave empty for now)

### 3. Configure Your Bot

Edit `config/main.yml`:

```yaml
bots:
  - id: my-first-bot
    name: "My Awesome Bot"
    auto_responses:
      - pattern: "hello|hi|hey"
        response: "Hello! How can I help you today?"
        case_insensitive: true

      - pattern: "bye|goodbye"
        response: "Goodbye! Have a great day! 👋"
```

### 4. Start Your Bot

```bash
npm start
```

1. Scan the QR code with WhatsApp on your phone
2. Send "hello" to your bot
3. Get instant response!

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

### E-commerce Bot with Webhook

```yaml
bots:
  - id: shop-bot
    name: "Shop Bot"
    auto_responses:
      - pattern: "catalog|products"
        response: "Here's our catalog: [link]"

    webhooks:
      - pattern: "order|buy"
        url: "https://your-api.com/process-order"
        method: POST
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

- **`id`**: Unique identifier (used for sessions)
- **`name`**: Display name
- **`phone`**: Phone number (optional)
- **`auto_responses`**: Instant replies
- **`webhooks`**: Delegate to external services
- **`settings`**: Bot behavior options

### Auto-Responses

```yaml
auto_responses:
  - pattern: "your regex pattern"
    response: "Your reply message"
    case_insensitive: true  # optional
    priority: 1            # optional, lower = higher priority
```

### Webhooks

```yaml
webhooks:
  - name: "my-webhook"
    pattern: "trigger words"
    url: "https://your-api.com/webhook"
    method: POST
    headers:
      Authorization: "Bearer your-token"
    timeout: 5000
    retry: 3
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

## 🌐 REST API

Send messages programmatically:

```bash
curl -X POST http://localhost:3000/api/v1/bots/my-bot/messages \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": "Hello from API!"
  }'
```

## 📂 Project Structure

```
whatsapp-botforge/
├── config/
│   └── main.yml          # Your bot configurations
├── src/                  # Source code
├── .wwebjs_auth/         # WhatsApp sessions
└── package.json
```

## 🛠️ Advanced Usage

### Using Includes

Organize large configs:

```yaml
# main.yml
bots:
  - !include bots/support.yml
  - !include bots/sales.yml
```

### Environment Variables

```bash
# .env
WEBHOOK_SECRET=your-secret
API_KEY=your-api-key
```

### Docker Deployment

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Use Cases

- **Customer Support**: Auto-respond to common questions
- **E-commerce**: Handle orders via webhooks
- **Notifications**: Send alerts from your systems
- **Lead Generation**: Capture and route inquiries
- **Internal Tools**: Team communication bots
- **AI Integration**: Connect to ChatGPT, Claude, etc.

## ❓ Troubleshooting

**QR Code not showing?**
- Make sure no other WhatsApp sessions are active
- Try restarting the bot

**Messages not sending?**
- Check bot status: `GET /health`
- Verify phone number format

**Webhook not working?**
- Test your endpoint with a tool like Postman
- Check logs for timeout errors

## 📚 Resources

- [Full Documentation](https://docs.botforge.dev)
- [Configuration Examples](https://github.com/yourusername/whatsapp-botforge/tree/main/examples)
- [Community Discord](https://discord.gg/botforge)

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

**Made with ❤️ for the no-code bot community**

*Have questions? Open an issue or join our Discord!*
