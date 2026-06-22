# WWeb BotForge — Architecture & Design

## Overview

WWeb BotForge is a config-driven WhatsApp bot framework. Bots, flows, and
actions are defined entirely in YAML — no code required to add or modify bot
behavior. The runtime loads YAML config at startup, maps it to domain objects,
and orchestrates WhatsApp sessions, message routing, flow execution, and
outbound message queuing.

The design prioritizes simplicity over formalism: plain data objects, pure
functions, and a handful of stateful services wired together via constructor
injection. No layers of abstraction where a direct call suffices.

---

## Source Structure

```
src/
├── cli.ts                CLI entry point (Commander.js)
├── config/
│   ├── types.ts          YAML config shapes (snake_case interfaces)
│   └── yaml.ts           YAML loader with !include support
├── utils/
│   ├── logger.ts       Pino-based structured logger
│   ├── fuzzy.ts        Fuse.js fuzzy matching wrapper
│   └── validation.ts   ID, priority, and delay validators
├── bot/
│   ├── types.ts          Bot domain types (Bot, FlowRef, BotSettings)
│   ├── bot.ts            Pure factories (createBot, createDefaultSettings)
│   ├── fleet.ts          BotFleet: orchestration root, wiring, lifecycle
│   ├── mapper.ts         Snake_case config → camelCase domain objects
├── whatsapp/
│   ├── types.ts          WhatsApp-specific helpers, message adapters
│   ├── client.ts         WhatsAppChannel (implements MessageChannel) + WhatsAppInitializer
│   └── session.ts        SessionManager singleton for channel lifecycle
├── flow/
│   ├── types.ts          Flow domain types (FlowDef, FlowStep, FlowBranch, FlowState, ...)
│   ├── executor.ts       FlowExecutor: message routing & state machine
│   ├── state.ts          FlowStateService: SQLite-backed flow session persistence
│   └── mapper.ts         FlowConfig YAML → FlowDef domain objects
├── action/
│   ├── types.ts          Action domain types (ActionDef, ActionExecutionContext, ...)
│   ├── executor.ts       Pure functions: executeAction, getAction
│   ├── catalog.ts        ActionCatalog builder from YAML config
│   ├── cooldown.ts       CooldownService: in-memory per-sender rate limiting
│   ├── webhook.ts        sendWebhookRequest: fetch + retry + exponential backoff
│   └── template.ts       Variable interpolation ({{ sender }}, {{ message }}, ...)
├── messaging/
│   ├── types.ts          Messaging domain (MessageChannel, IncomingMessage, OutgoingMessage, WebhookPayload)
│   ├── inbox.ts          InboxService: message listener registration & filtering
│   └── outbox.ts         OutboxService: per-bot FIFO message queue with delays
├── api/
│   ├── server.ts         ApiServer: Express server lifecycle
│   └── routes/
│       ├── health.ts     GET /api/health
│       ├── bots.ts       GET /api/bots, /api/bots/:botId
│       └── messages.ts   POST /api/messages/send, GET /api/messages/queue
└── commands/
    └── create-bot.ts     Interactive inquirer wizard for first-time bot setup
```

---

## Core Architecture

### Domain Model

Domain concepts are plain TypeScript interfaces with no behavior:

| Interface | Role |
|---|---|
| `Bot` | Bot identity, settings, sorted flow references, channel reference |
| `MessageChannel` | Transport abstraction: send, onMessage, connect, disconnect, lifecycle events |
| `IncomingMessage` / `OutgoingMessage` | Normalized message format independent of WhatsApp wire format |
| `FlowDef` | Flow definition: triggers, entry step, steps, branches, timeout, fallback |
| `FlowStep` | A step within a flow: action reference + optional branch conditions |
| `FlowBranch` | Branching condition: fuzzy-matched phrases + target step |
| `ActionDef` | What happens when an action fires: optional reply text + optional webhook |
| `FlowState` | Runtime state for an in-progress flow session (sender, current step, timeout) |
| `ConfigFile` | Raw YAML shape: global settings + actions + flows + bots |

### Transport Abstraction

`MessageChannel` is the sole interface between domain logic and WhatsApp
concrete. `WhatsAppChannel` implements it via `whatsapp-web.js`. Swapping to
another messaging platform requires only a new `MessageChannel` implementation
— bots, flows, and actions remain untouched.

### Dependency Wiring

`BotFleet` is the composition root. At startup it:
1. Loads YAML config into `ConfigFile`
2. Maps config to action catalog, flow catalog, and bot domain objects
3. Instantiates services: `FlowStateService`, `FlowExecutor`, `CooldownService`
4. Creates WhatsApp channels via `SessionManager`
5. Registers each bot with `InboxService` and `OutboxService`
6. Optionally starts `ApiServer`

All dependencies are passed via constructor — no service locators or global mutable state (except logger and WhatsApp global config).

### Message Flow

```
WhatsApp message
  → WhatsAppChannel.onMessage
    → InboxService (filter: ignored senders, groups, self-messages)
      → FlowExecutor.handleMessage()
        → active flow? → match branch → transition step → executeAction()
        → new message? → match flow triggers by priority → enter flow
        → executeAction()
          → resolve template variables
          → check cooldown
          → enqueue reply → OutboxService → WhatsAppChannel.send()
          → fire webhook → sendWebhookRequest()
```

### Flow State Machine

`FlowExecutor` manages per-user flow sessions via `FlowStateService` (SQLite):
- **Active session**: Incoming messages are routed to the current step's branches via fuzzy matching. Matching branch transitions to `goto` step.
- **No session**: Message is matched against all flows' triggers (sorted by priority). First match enters the flow at its `entry_step`.
- **Terminal steps**: Steps without branches destroy the session on execution.
- **Timeout**: Sessions expire after configurable idle timeout (`sessionTimeout`).
- **Fallback**: Unmatched branches fall through to `fallback_step` if configured.

Both triggers and branch conditions use Fuse.js fuzzy string matching, supporting comma-separated multi-phrase lists with configurable thresholds.

### Outbox Pattern

Outgoing messages are not sent directly. They're enqueued per-bot with a configurable inter-message delay (`queue_delay`). This prevents rate-limiting and provides queue visibility via the API (`GET /api/messages/queue/:botId`).

### Config Mapper Pattern

YAML config uses snake_case keys (the conventional YAML style). Dedicated mapper functions convert these to camelCase domain objects:

```
BotConfig (snake_case)  → mapConfigToBot()  → Bot (camelCase)
FlowConfig (snake_case) → mapFlowCatalog()  → FlowCatalog (Map<id, FlowDef>)
ActionConfig             → mapActionCatalog() → ActionCatalog (Map<id, ActionDef>)
```

This decouples the file format from the internal model — YAML can evolve independently.

### Catalog Pattern

Actions and flows are loaded into `Map<string, T>` catalogs at startup for O(1) lookup:
- `ActionCatalog`: `Map<string, ActionDef>`
- `FlowCatalog`: `Map<string, FlowDef>`

Bots reference flows by ID. Flows reference actions by ID within their steps.

---

## API Layer

A lightweight Express server exposes:
- `GET /api/health` — Liveness check
- `GET /api/bots` — List all bots
- `GET /api/bots/:botId` — Individual bot status
- `POST /api/messages/send` — Enqueue a message via OutboxService
- `GET /api/messages/queue/:botId` — Per-bot queue status
- `GET /api/messages/queue` — All queues status

The API receives `OutboxService` and bots map via constructor — it accesses the same services as the core runtime.

---

## YAML Configuration

```yaml
global:
  apiEnabled: true
  apiPort: 3000
  logLevel: info
  sessionTimeout: 300

actions:
  hello_reply:
    reply: "Hello {{ sender }}! You said: {{ message }}"

  notify_slack:
    webhook:
      url: https://hooks.slack.com/...
      method: POST
      retry: 3

  with_cooldown:
    reply: "Processing..."
    cooldown: 60
    cooldown_reply: "Please wait {{ variables.remaining }} seconds"

flows:
  welcome:
    triggers: "hi, hello, hey"
    entry_step: greet
    steps:
      greet:
        action: hello_reply

  support_flow:
    triggers: "help, support, problem"
    entry_step: ask_issue
    timeout: 120
    fallback_step: didnt_understand
    steps:
      ask_issue:
        action: ask_what_issue
        branches:
          - when: "login, password, can't access"
            goto: login_help
          - when: "payment, billing, charge"
            goto: billing_help
      login_help:
        action: login_solution
      billing_help:
        action: billing_solution
      didnt_understand:
        action: fallback_reply

bots:
  support:
    flows:
      - id: welcome
        priority: 10
      - id: support_flow
        priority: 5
    settings:
      simulate_typing: true
      typing_delay: 1500
      queue_delay: 500
      ignore_groups: true
      ignored_senders:
        - "123456789@c.us"
```

### `!include` Directive

Config files support YAML `!include` tags to split configuration across files:

```yaml
actions: !include actions/main.yml
flows: !include flows/main.yml

bots:
  support: !include bots/support.yml
  sales: !include bots/sales.yml
```

Additionally, files placed in `actions/`, `flows/`, and `bots/` directories relative to the config file are auto-loaded and merged with any inline definitions.

---

## Design Principles

1. **Plain data over class hierarchies** — domain concepts are interfaces, not classes with behavior
2. **Pure functions over methods** — business logic lives in standalone functions, not object methods
3. **Composition over inheritance** — services are composed at startup, not extended
4. **Constructor injection** — dependencies are passed explicitly, no service locators
5. **Config-driven behavior** — bots, flows, and actions are YAML-defined, not coded
6. **One bounded context** — the entire codebase is a single module; core bot domain in `bot/types.ts`, messaging contracts in `messaging/types.ts`, config shapes in `config/types.ts`
7. **Minimal abstraction** — add an abstraction only when there's a concrete need (see: `MessageChannel`)
8. **Direct calls** — `FlowExecutor` calls `outboxService.enqueue()` directly, no event bus or mediator
