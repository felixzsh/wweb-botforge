# Botdeck — Architecture & Design

## Overview

Botdeck is a config-driven WhatsApp bot framework. Bots, graphs, and
actions are defined entirely in YAML — no code required to add or modify bot
behavior. The runtime loads YAML config at startup, maps it to domain objects,
and orchestrates WhatsApp sessions, message routing, graph execution, and
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
│   ├── schema.ts         YAML config shapes (snake_case interfaces)
│   ├── yaml.ts           YAML loader with !include support
│   └── watcher.ts        ConfigWatcher: live reload on file changes
├── helpers/
│   ├── logger.ts         Pino-based structured logger
│   ├── fuzzy.ts          Fuse.js fuzzy matching wrapper
│   └── validation.ts     ID and numeric validators
├── bot.ts                Bot domain (Bot, BotSettings) + factories
├── fleet.ts              BotFleet: orchestration root, wiring, lifecycle
├── graph/
│   ├── graph.ts          Graph domain types (GraphDef, Node, Edge, GraphState, ...)
│   ├── executor.ts       GraphExecutor: message routing & state machine
│   └── state.ts          GraphStateService: SQLite-backed graph session persistence
├── action/
│   ├── action.ts         Action domain types + pure execution functions
│   ├── cooldown.ts       CooldownService: in-memory per-sender rate limiting
│   └── request.ts        sendRequest: fetch + retry + exponential backoff
├── messages/
│   ├── contracts.ts      Messaging domain (MessageChannel, IncomingMessage, OutgoingMessage, RequestPayload)
│   ├── inbox.ts          InboxService: message listener registration & filtering
│   └── outbox.ts         OutboxService: per-bot FIFO message queue with delays
├── api/
│   └── routes/           REST endpoints (health, bots, messages, status)
├── validation/
│   └── validate.ts       Config validation: schema, cross-references, reachability
├── whatsapp/
│   ├── client.ts         WhatsAppChannel (implements MessageChannel) + WhatsAppInitializer
│   └── session.ts        SessionManager singleton for channel lifecycle
└── commands/
    ├── auth.ts           Session authentication via QR
    ├── status.ts         Bot session status display
    ├── guide.ts          AI agent configuration guide
    └── validate.ts       Config validation CLI
```

---

## Core Architecture

### Domain Model

Domain concepts are plain TypeScript interfaces with no behavior:

| Interface | Role |
|---|---|
| `Bot` | Bot identity, settings, single graph reference, channel reference |
| `MessageChannel` | Transport abstraction: send, onMessage, connect, disconnect, lifecycle events |
| `IncomingMessage` / `OutgoingMessage` | Normalized message format independent of WhatsApp wire format |
| `GraphDef` | Graph definition: root, timeout, fallback, nodes |
| `Node` | A node within a graph: action reference + edge conditions |
| `Edge` | Edge: fuzzy-matched phrases + target node |
| `ActionDef` | What happens when an action fires: optional message body + optional request + optional location |
| `GraphState` | Runtime state for an in-progress graph session (sender, current node, timeout) |
| `ConfigFile` | Raw YAML shape: global settings + actions + graphs + bots |

### Transport Abstraction

`MessageChannel` is the sole interface between domain logic and WhatsApp
concrete. `WhatsAppChannel` implements it via `whatsapp-web.js`. Swapping to
another messaging platform requires only a new `MessageChannel` implementation
— bots, graphs, and actions remain untouched.

### Dependency Wiring

`BotFleet` is the composition root. At startup it:
1. Loads YAML config into `ConfigFile`
2. Maps config to action catalog, graph catalog, and bot domain objects
3. Instantiates services: `GraphStateService`, `GraphExecutor`, `CooldownService`
4. Creates WhatsApp channels via `SessionManager`
5. Registers each bot with `InboxService` and `OutboxService`
6. Optionally starts `ApiServer`

All dependencies are passed via constructor — no service locators or global mutable state (except logger and WhatsApp global config).

### Message Flow

```
WhatsApp message
  → WhatsAppChannel.onMessage
    → InboxService (filter: ignored senders, groups, self-messages)
      → GraphExecutor.handleMessage()
        → active session?  → match edge from current/visited nodes → transition → executeAction()
        → no active session? → create session at root, execute root action, then re-resolve
                               the user's original message against root edges
        → executeAction()
          → resolve template variables
          → check cooldown
          → enqueue reply → OutboxService → WhatsAppChannel.send()
          → fire request → sendRequest()
```

### Graph State Machine

`GraphExecutor` manages per-user graph sessions via `GraphStateService` (SQLite):

- **Active session**: Incoming messages are resolved against the current node's
  edges plus any previously visited nodes' edges (so a user can navigate
  backward). Fuzzy matching via Fuse.js, comma-separated phrase lists, configurable
  per-edge threshold.
- **No active session**: The bot creates a session at the graph's `root` node,
  executes the root action, and re-applies the user's original message against
  the root edges. The first message is never discarded.
- **Fallback**: Unmatched input falls through to `fallback` if configured.
- **Timeout**: Sessions expire after configurable idle timeout (`default_timeout`
  or per-graph `timeout`). Any subsequent message starts a new session at root.
- **No terminal nodes**: A node with `edges: []` does not destroy the session;
  the user can still reach other visited nodes via their own edges. Sessions
  only end via timeout.

Edge conditions and trigger phrases both use Fuse.js fuzzy string matching
with the same per-phrase threshold mechanism.

### Outbox Pattern

Outgoing messages are not sent directly. They're enqueued per-bot with a
configurable inter-message delay (`queue_delay`). This prevents rate-limiting
and provides queue visibility via the API
(`GET /api/messages/queue/:botId`).

### Config Mapper Pattern

YAML config uses snake_case keys (the conventional YAML style). Dedicated mapper
functions convert these to camelCase domain objects:

```
BotConfig (snake_case)    → mapConfigToBot()  → Bot (camelCase)
GraphConfig (snake_case)  → mapGraphCatalog()  → GraphCatalog (Map<id, GraphDef>)
ActionConfig (snake_case) → mapActionCatalog() → ActionCatalog (Map<id, ActionDef>)
```

This decouples the file format from the internal model — YAML can evolve
independently.

### Catalog Pattern

Actions and graphs are loaded into `Map<string, T>` catalogs at startup for O(1)
lookup:
- `ActionCatalog`: `Map<string, ActionDef>`
- `GraphCatalog`: `Map<string, GraphDef>`

Nodes reference actions by ID. Bots reference a single graph by ID.

---

## API Layer

A lightweight Express server exposes:
- `GET /api/health` — Liveness check
- `GET /api/bots` — List all bots
- `GET /api/bots/:botId` — Individual bot status
- `POST /api/messages/send` — Enqueue a message via OutboxService
- `GET /api/messages/queue/:botId` — Per-bot queue status
- `GET /api/messages/queue` — All queues status

The API receives `OutboxService` and bots map via constructor — it accesses the
same services as the core runtime.

---

## YAML Configuration

```yaml
port: 3000
address: "127.0.0.1"
log_level: info
default_timeout: 300

actions:
  hello_reply:
    steps:
      - message:
          body: "Hello {{ sender }}! You said: {{ message }}"

  notify_slack:
    steps:
      - request:
          url: https://hooks.slack.com/...
          method: POST
          retry: 3

  with_cooldown:
    guards:
      cooldown:
        duration: 60
        on_blocked:
          - message:
              body: "Please wait {{ variables.remaining }} seconds"
    steps:
      - message:
          body: "Processing..."

graphs:
  support:
    root: ask_issue
    timeout: 120
    fallback: didnt_understand
    nodes:
      ask_issue:
        action: ask_what_issue
        edges:
          - match: "login, password, can't access"
            goto: login_help
          - match: "payment, billing, charge"
            goto: billing_help
      login_help:
        action: login_solution
        edges:
          - match: "menu, back"
            goto: ask_issue
      billing_help:
        action: billing_solution
        edges:
          - match: "menu, back"
            goto: ask_issue
      didnt_understand:
        action: fallback_reply
        edges:
          - goto: ask_issue

bots:
  support:
    graph: support
    settings:
      queue_delay: 500
      ignore_groups: true
      ignored_senders:
        - "123456789@c.us"
```

### `!include` Directive

Config files support YAML `!include` tags to split configuration across files:

```yaml
actions: !include actions/main.yml
graphs: !include graphs/main.yml

bots:
  support: !include bots/support.yml
  sales: !include bots/sales.yml
```

Additionally, files placed in `actions/`, `graphs/`, and `bots/` directories
relative to the config file are auto-loaded and merged with any inline
definitions.

---

## Design Principles

1. **Plain data over class hierarchies** — domain concepts are interfaces, not classes with behavior
2. **Pure functions over methods** — business logic lives in standalone functions, not object methods
3. **Composition over inheritance** — services are composed at startup, not extended
4. **Constructor injection** — dependencies are passed explicitly, no service locators
5. **Config-driven behavior** — bots, graphs, and actions are YAML-defined, not coded
6. **One bounded context** — the entire codebase is a single module; core bot domain in `bot.ts`, messaging contracts in `messages/contracts.ts`, config shapes in `config/schema.ts`
7. **Minimal abstraction** — add an abstraction only when there's a concrete need (see: `MessageChannel`)
8. **Direct calls** — `GraphExecutor` calls `outboxService.enqueue()` directly, no event bus or mediator
