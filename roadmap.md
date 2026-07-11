
---

## Phase 1 — Authentication (`lock` / `unlock`)

Optional but recommended auth mechanism to protect the API and the future Web UI when `address` is not `localhost`.

### Design principles

- Botforje **does not manage users**. It only knows a single secret: the **`key`**.
- The `key` is a high-entropy secret (32+ characters, generated with a CSPRNG such as `crypto.randomBytes`), not a human-chosen password.
- It's stored **hashed with SHA-256** (fast, appropriate for high-entropy random secrets — not bcrypt/argon2, which are meant for low-entropy human-chosen passwords).
- It's stored in **sqlite** (not in `config.yml`), since it's an operational secret that can be regenerated, not declarative configuration.
- Hash comparison always uses `crypto.timingSafeEqual` to avoid timing attacks.

### `botforje lock` command

- No protection is active by default. If `address` ≠ `localhost`, a **warning** is emitted recommending running `lock`.
- `botforje lock`:
  - Generates a random `key` (32+ characters).
  - Accepts an optional parameter: `botforje lock --key=<value>` so the user can supply their own key (e.g. automated/CI deployments). The code **only validates format and length (32+)**, it doesn't generate it itself in that case.
  - Hashes the key (SHA-256) and stores the hash in sqlite (overwrites if one already existed).
  - Prints the key to stdout **once only**, with a warning that it cannot be recovered afterward and must be saved somewhere safe.
  - Invalidates all active web sessions (deletes the sessions table or marks them invalid).

### `botforje unlock` command

- Requires the current `key` as confirmation (hashes the input and compares it against the stored hash).
- If it matches: deletes the hash from sqlite, disables the auth requirement on API/Web UI, invalidates active sessions.

### Key usage flow

1. **External API clients**: use the key as-is, on every request, via `Authorization: Bearer <key>`. Always the same until it's regenerated with `lock` again.
2. **Web UI**: asks for the key once (login screen). The server hashes the input and compares it against the hash in sqlite. If it matches, it issues a **session cookie** (`HttpOnly`), recorded in a separate sqlite table (`sessions`: token, created_at, expires_at). The browser resends it automatically on every request — no need to send the key again on each browser call.
3. When the session cookie expires, the Web UI asks for the key again (the same one, it doesn't change on its own) and issues a new cookie.
4. The key itself **never expires or changes on its own** — it only changes if `lock` is run again (regenerate).

### Preparing for the future (federated login integration — see Phase 5)

- Add a `scope_bot_ids` (nullable) column to the `sessions` table from the start, even though today it's always `null` (master session = sees all bots).
- Design the API/UI data layer so that every bot query is resolved "per session" (which bots does *this* session see?) instead of "all bots" — that way, when real scoping arrives, the business logic doesn't need to change, only the calculation of which IDs go into the filter.
- Leave an optional config field `trusted_issuers: []` (empty by default) reserved for public keys of a future external login server.

---

## Phase 2 — Web UI (v1: viewing and manual control)

Initial scope, **without** configuration yet (that's Phase 4):

- View the list of bots and their status.
- View active chats/conversations for each bot.
- Take manual control of a conversation and chat directly from the UI (bot override).
- Login via `key` as defined in Phase 1.

---

## Phase 3 — AI integration in the Graph

Architecture decisions already locked in:

### The Graph remains the core, fully declarative

```
Graph
 ├── Nodes
 ├── Edges
 └── State
```

AI does **not replace** the Graph — it complements it.

### Actions as the universal extension mechanism

They no longer represent only "reply to a message". They represent **any reusable behavior**: `welcome`, `search_song`, `add_song`, `notify_admin`, `execute_payment`, `generate_invoice`, etc.

All actions share the same definition, regardless of who invokes them (a node automatically, the AI, or in the future a webhook):

```yaml
actions:
  add_song:
    steps:
      - script:
          file: scripts/add_song.lua
          exports:
            songs_added: int
            duplicated: bool
      - message:
          body: "{{songs_added}} songs added."
```

### Nodes only declare which actions are available

The node contains no AI logic. It simply says: "while the user is here, these actions are available to the AI":

```yaml
nodes:
  create_package:
    on_enter:
      - welcome
    ai_tools:
      - search_song
      - add_song
      - remove_song
      - approve_package
```

### AI has exactly two responsibilities

**1. Resolve navigation** (never responds directly):

```
Message → Fuzzy Match → Edge found? → No → LLM → Target node
```

The LLM only decides which node to go to. If it doesn't find an appropriate one, it falls back to a `fallback_node` configurable by the developer.

**2. Execute Actions exposed by the current node**

The LLM receives only: the message, the `state`, and the list of actions allowed by the active node (it can never execute actions the node hasn't exposed). Example: user writes "add Hotel California and Bohemian Rhapsody" → LLM decides `search_song()` → `add_song()` → replies to the user.

### There are no "AI Nodes" or "AI Actions"

Explicit design decision: **all nodes are just Nodes** (some simply enable AI via `ai_tools`), and **all actions are just Actions** (the only thing that changes is who invokes them: the node automatically or the AI). There's no separate category for either.

---

## Phase 3.1 — Unified State (part of the same AI/Graph work)

### Base framework state (always exists)

```
state.message
state.sender
state.bot
state.session
state.current_node
state.visited_nodes
```

### Each node can extend the state

```yaml
nodes:
  create_package:
    state:
      package_id: null
      songs: []
      customer: null
```

A single `state` object — there are no two separate contexts. Everything (scripts, templates, webhooks) uses the same mental model:

```yaml
message:
  body: |
    Hello {{state.sender.name}}
    Songs:
    {{state.songs}}
```

```yaml
webhook:
  body:
    package: "{{state.package_id}}"
```

### New step type: `script`

The engine executes:

```
execute_script(file="add_song.lua", exports={songs_added: int, duplicated: bool}, state=session_state)
```

The script receives the full `state` object, can read and modify it, and returns a result that the engine merges into the state before continuing with the following `steps`:

```lua
-- state.message = "add Hotel California"
local songs = searchSongs(state.message)
table.insert(state.songs, songs[1])

return {
    songs_added = #songs
}
```

Or by modifying the state directly:

```lua
state.songs = songs
return {
    songs_added = #songs
}
```

---

## Phase 4 — Web UI (v2: full configuration)

- Reach full parity with everything configurable today via YAML (bots, graphs, nodes, edges, actions, state, webhooks), but editable 100% visually from the Web UI.

---

## Phase 5 — Federated login service integration (multi-client / business)

Vision: a **separate** login service, external to Botforje, that manages users/clients/plans and redirects to the correct Botforje instance (VPS) where their bots live, with the session already authenticated and scoped only to their bots.

**Botforje still knows nothing about users.** It only learns to trust signed, scope-limited tokens.

### Proposed mechanism

1. **Asymmetric keys, not a shared secret**: the login server holds a private key; each Botforje instance has the corresponding public key configured (`trusted_issuers`, see Phase 1). This way, compromising one VPS doesn't allow forging tokens for other instances.
2. The login server resolves, with its own business logic, which bots belong to the authenticated client and on which Botforje instance they live.
3. It issues a **signed JWT**, short-lived (~60s, just enough to complete the redirect), with the scope inside:
   ```json
   {
     "scope_bot_ids": ["gym-bot-1", "gym-bot-2"],
     "exp": 1720000060,
     "iss": "login.yourdomain.com"
   }
   ```
4. Redirects the browser to the corresponding Botforje instance with the token (via POST auto-submit or URL fragment `#token=...`, never in a plain query string).
5. Botforje verifies the signature with the configured public key:
   - If valid, it creates a normal session (same sessions table from Phase 1) with `scope_bot_ids` populated.
   - The API and Web UI for that session automatically filter to only show/manage those bots.
   - A session with no `scope_bot_ids` (`null`) = the usual master session (login with `key`), sees everything.

### What stays out of Botforje's scope

- All user, client, plan, and billing management → lives in the separate login service.
- The logic of which client has access to which bots → also lives there.
- Botforje only needs to: verify signatures, and filter by `scope_bot_ids` within a session.

# Botforje — Roadmap

> Rename: `wweb-botforge` → **Botforje**
> Name origin: no direct semantic connection, chosen purely for how it sounds.

---

## Phase 1 — Authentication (`lock` / `unlock`)

Optional but recommended auth mechanism to protect the API and the future Web UI when `address` is not `localhost`.

### Design principles

- Botforje **does not manage users**. It only knows a single secret: the **`key`**.
- The `key` is a high-entropy secret (32+ characters, generated with a CSPRNG such as `crypto.randomBytes`), not a human-chosen password.
- It's stored **hashed with SHA-256** (fast, appropriate for high-entropy random secrets — not bcrypt/argon2, which are meant for low-entropy human-chosen passwords).
- It's stored in **sqlite** (not in `config.yml`), since it's an operational secret that can be regenerated, not declarative configuration.
- Hash comparison always uses `crypto.timingSafeEqual` to avoid timing attacks.

### `botforje lock` command

- No protection is active by default. If `address` ≠ `localhost`, a **warning** is emitted recommending running `lock`.
- `botforje lock`:
  - Generates a random `key` (32+ characters).
  - Accepts an optional parameter: `botforje lock --key=<value>` so the user can supply their own key (e.g. automated/CI deployments). The code **only validates format and length (32+)**, it doesn't generate it itself in that case.
  - Hashes the key (SHA-256) and stores the hash in sqlite (overwrites if one already existed).
  - Prints the key to stdout **once only**, with a warning that it cannot be recovered afterward and must be saved somewhere safe.
  - Invalidates all active web sessions (deletes the sessions table or marks them invalid).

### `botforje unlock` command

- Requires the current `key` as confirmation (hashes the input and compares it against the stored hash).
- If it matches: deletes the hash from sqlite, disables the auth requirement on API/Web UI, invalidates active sessions.

### Key usage flow

1. **External API clients**: use the key as-is, on every request, via `Authorization: Bearer <key>`. Always the same until it's regenerated with `lock` again.
2. **Web UI**: asks for the key once (login screen). The server hashes the input and compares it against the hash in sqlite. If it matches, it issues a **session cookie** (`HttpOnly`), recorded in a separate sqlite table (`sessions`: token, created_at, expires_at). The browser resends it automatically on every request — no need to send the key again on each browser call.
3. When the session cookie expires, the Web UI asks for the key again (the same one, it doesn't change on its own) and issues a new cookie.
4. The key itself **never expires or changes on its own** — it only changes if `lock` is run again (regenerate).

### Preparing for the future (federated login integration — see Phase 5)

- Add a `scope_bot_ids` (nullable) column to the `sessions` table from the start, even though today it's always `null` (master session = sees all bots).
- Design the API/UI data layer so that every bot query is resolved "per session" (which bots does *this* session see?) instead of "all bots" — that way, when real scoping arrives, the business logic doesn't need to change, only the calculation of which IDs go into the filter.
- Leave an optional config field `trusted_issuers: []` (empty by default) reserved for public keys of a future external login server.

---

## Phase 2 — Web UI (v1: viewing and manual control)

Initial scope, **without** configuration yet (that's Phase 4):

- View the list of bots and their status.
- View active chats/conversations for each bot.
- Take manual control of a conversation and chat directly from the UI (bot override).
- Login via `key` as defined in Phase 1.

---

## Phase 3 — AI integration in the Graph

Architecture decisions already locked in:

### The Graph remains the core, fully declarative

```
Graph
 ├── Nodes
 ├── Edges
 └── State
```

AI does **not replace** the Graph — it complements it.

### Actions as the universal extension mechanism

They no longer represent only "reply to a message". They represent **any reusable behavior**: `welcome`, `search_song`, `add_song`, `notify_admin`, `execute_payment`, `generate_invoice`, etc.

All actions share the same definition, regardless of who invokes them (a node automatically, the AI, or in the future a webhook):

```yaml
actions:
  add_song:
    steps:
      - script:
          file: scripts/add_song.lua
          exports:
            songs_added: int
            duplicated: bool
      - message:
          body: "{{songs_added}} songs added."
```

### Nodes only declare which actions are available

The node contains no AI logic. It simply says: "while the user is here, these actions are available to the AI":

```yaml
nodes:
  create_package:
    on_enter:
      - welcome
    ai_tools:
      - search_song
      - add_song
      - remove_song
      - approve_package
```

### AI has exactly two responsibilities

**1. Resolve navigation** (never responds directly):

```
Message → Fuzzy Match → Edge found? → No → LLM → Target node
```

The LLM only decides which node to go to. If it doesn't find an appropriate one, it falls back to a `fallback_node` configurable by the developer.

**2. Execute Actions exposed by the current node**

The LLM receives only: the message, the `state`, and the list of actions allowed by the active node (it can never execute actions the node hasn't exposed). Example: user writes "add Hotel California and Bohemian Rhapsody" → LLM decides `search_song()` → `add_song()` → replies to the user.

### There are no "AI Nodes" or "AI Actions"

Explicit design decision: **all nodes are just Nodes** (some simply enable AI via `ai_tools`), and **all actions are just Actions** (the only thing that changes is who invokes them: the node automatically or the AI). There's no separate category for either.

---

## Phase 3.1 — Unified State (part of the same AI/Graph work)

### Base framework state (always exists)

```
state.message
state.sender
state.bot
state.session
state.current_node
state.visited_nodes
```

### Each node can extend the state

```yaml
nodes:
  create_package:
    state:
      package_id: null
      songs: []
      customer: null
```

A single `state` object — there are no two separate contexts. Everything (scripts, templates, webhooks) uses the same mental model:

```yaml
message:
  body: |
    Hello {{state.sender.name}}
    Songs:
    {{state.songs}}
```

```yaml
webhook:
  body:
    package: "{{state.package_id}}"
```

### New step type: `script`

The engine executes:

```
execute_script(file="add_song.lua", exports={songs_added: int, duplicated: bool}, state=session_state)
```

The script receives the full `state` object, can read and modify it, and returns a result that the engine merges into the state before continuing with the following `steps`:

```lua
-- state.message = "add Hotel California"
local songs = searchSongs(state.message)
table.insert(state.songs, songs[1])

return {
    songs_added = #songs
}
```

Or by modifying the state directly:

```lua
state.songs = songs
return {
    songs_added = #songs
}
```

---

## Phase 4 — Web UI (v2: full configuration)

- Reach full parity with everything configurable today via YAML (bots, graphs, nodes, edges, actions, state, webhooks), but editable 100% visually from the Web UI.

---

## Phase 5 — Federated login service integration (multi-client / business)

Vision: a **separate** login service, external to Botforje, that manages users/clients/plans and redirects to the correct Botforje instance (VPS) where their bots live, with the session already authenticated and scoped only to their bots.

**Botforje still knows nothing about users.** It only learns to trust signed, scope-limited tokens.

### Proposed mechanism

1. **Asymmetric keys, not a shared secret**: the login server holds a private key; each Botforje instance has the corresponding public key configured (`trusted_issuers`, see Phase 1). This way, compromising one VPS doesn't allow forging tokens for other instances.
2. The login server resolves, with its own business logic, which bots belong to the authenticated client and on which Botforje instance they live.
3. It issues a **signed JWT**, short-lived (~60s, just enough to complete the redirect), with the scope inside:
   ```json
   {
     "scope_bot_ids": ["gym-bot-1", "gym-bot-2"],
     "exp": 1720000060,
     "iss": "login.yourdomain.com"
   }
   ```
4. Redirects the browser to the corresponding Botforje instance with the token (via POST auto-submit or URL fragment `#token=...`, never in a plain query string).
5. Botforje verifies the signature with the configured public key:
   - If valid, it creates a normal session (same sessions table from Phase 1) with `scope_bot_ids` populated.
   - The API and Web UI for that session automatically filter to only show/manage those bots.
   - A session with no `scope_bot_ids` (`null`) = the usual master session (login with `key`), sees everything.

### What stays out of Botforje's scope

- All user, client, plan, and billing management → lives in the separate login service.
- The logic of which client has access to which bots → also lives there.
- Botforje only needs to: verify signatures, and filter by `scope_bot_ids` within a session.
