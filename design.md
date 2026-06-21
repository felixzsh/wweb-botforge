# WWeb BotForge - Domain and Infrastructure Design

## Overview
This document outlines the initial domain model and infrastructure design for WWeb BotForge, focusing on representing bots as objects deserialized from YAML configurations. The design supports two loading approaches: a single `main.yml` file or a `main.yml` that includes other YAML files.

## Folder Structure
A scalable and maintainable structure following Domain-Driven Design (DDD) principles:

```
botforge/
├── src/
│   ├── core/
│   │   ├── domain/           # Core domain
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   └── interfaces/
│   │   ├── application/      # Application logic
│   │   └── infrastructure/   # Concrete implementations
│   ├── cli/                 # CLI commands
│   └── api/                 # REST API (future)
├── config/
│   └── main.yml            # Main configuration
├── .wwebjs_auth/           # WhatsApp sessions
└── tests/
```

- `core/domain/`: Pure business logic with entities, value objects, and interfaces
- `core/application/`: Use cases and application services
- `core/infrastructure/`: External concerns like file I/O, databases, and concrete implementations
- `cli/`: Command-line interface tools
- `api/`: REST API endpoints (future)
- `config/`: Configuration files
- `.wwebjs_auth/`: WhatsApp session storage

## Infrastructure Proposals

### Repository Implementations
- **YamlBotRepository**: Implements `IBotRepository` using YAML files as storage
- **InMemoryBotRepository**: For testing and development

### External Service Adapters
- **YamlLoader**: Handles loading and parsing YAML configurations with include support
- **WebhookClient**: HTTP client for sending webhook requests with retry logic
- **WhatsAppClientAdapter**: Wrapper around whatsapp-web.js for domain isolation

### Configuration Management
- **ConfigManager**: Centralizes access to application configuration
- **EnvironmentConfig**: Loads settings from environment variables

### Persistence
- **SessionStore**: Manages WhatsApp session files (.wwebjs_auth)
- **FileSystemAdapter**: Abstraction for file operations

### Logging and Monitoring
- **LoggerAdapter**: Standardized logging interface
- **MetricsCollector**: Collects usage metrics (future)

## Validation of Loading Approaches

### Approach 1: Single main.yml
```yaml
# config/main.yml
bots:
  support-bot:
    name: "Support Bot"
    flows:
      - id: faq
        priority: 10
    settings:
      simulate_typing: true

  sales-bot:
    name: "Sales Bot"
    flows:
      - id: sales-flow
        priority: 5
```

Result: `YamlLoader.loadMainConfig()` returns a `RawConfig` with `bots` array containing the two bot objects directly.

### Approach 2: main.yml with includes
```yaml
# config/main.yml
bots:
  - !include bots/support-bot.yml
  - !include bots/sales-bot.yml
```

```yaml
# config/bots/support-bot.yml
id: support-bot
name: "Support Bot"
flows:
  - id: faq
    priority: 10
settings:
  simulate_typing: true
```

Result: `YamlLoader.loadMainConfig()` detects `!include`, loads `soporte-bot.yml` and `ventas-bot.yml`, merges them into the `bots` array in `RawConfig`.

In both cases, `BotFactory.createBots()` produces an array of `Bot` entities that can be used by the application layer.

## Architecture Diagram

```mermaid
graph TD
    A[main.yml] --> B[YamlLoader]
    B --> C[RawConfig]
    C --> D[BotFactory]
    D --> E[Bot[]]

    F[bots/*.yml] --> B

    E --> G[Application Services]
    G --> H[IBotRepository]
    H --> I[Infrastructure Implementations]
    I --> J[whatsapp-web.js instances]
```

This design ensures:
- **Domain-Driven Design**: Clear separation between domain, application, and infrastructure
- **Rich Domain Model**: Entities with behavior, value objects with validation
- **Dependency Inversion**: Domain depends on interfaces, infrastructure implements them
- **Testability**: Each layer can be unit tested independently
- **Flexibility**: Supports both YAML organization approaches
- **Scalability**: Easy to add more entities, use cases, or infrastructure implementations
