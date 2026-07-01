import { Bot } from '../bot'
import { IncomingMessage, WebhookPayload } from '../messages/contracts'
import { ActionCatalog, ActionExecutionContext } from '../actions/action'
import { GraphCatalog, GraphDef, Node, Edge, GraphState } from './graph'
import { executeAction, getAction } from '../actions/action'
import { resolveVars } from '../actions/action'
import { GraphStateService } from './state'
import { OutboxService } from '../messages/outbox'
import { CooldownService } from '../actions/cooldown'
import { sendWebhookRequest } from '../actions/webhook'
import { matchFuzzyVerbose } from '../helpers/fuzzy'
import { getLogger } from '../helpers/logger'

interface EdgeMatch {
  edge: Edge
  score: number
  nodeIndex: number
}

export class GraphExecutor {
  constructor(
    private actionCatalog: ActionCatalog,
    private graphCatalog: GraphCatalog,
    private graphStateService: GraphStateService,
    private outboxService: OutboxService,
    private defaultTimeout: number = 300,
    private cooldownService?: CooldownService
  ) {}

  private get logger() {
    return getLogger()
  }

  updateCatalogs(actionCatalog: ActionCatalog, graphCatalog: GraphCatalog): void {
    this.actionCatalog = actionCatalog
    this.graphCatalog = graphCatalog
  }

  async handleMessage(bot: Bot, message: IncomingMessage): Promise<boolean> {
    this.graphStateService.cleanupExpired()

    const state = this.graphStateService.findActive(message.from, bot.id)

    if (state) {
      return this.handleActiveState(bot, message, state)
    }

    return this.handleNewSession(bot, message)
  }

  private async handleNewSession(bot: Bot, message: IncomingMessage): Promise<boolean> {
    const graphId = bot.graph
    if (!graphId) {
      this.logger.error(`Bot "${bot.id}" has no graph assigned`)
      return false
    }

    const graph = this.graphCatalog.get(graphId)
    if (!graph) {
      this.logger.error(`Graph "${graphId}" referenced by bot "${bot.id}" not found`)
      return false
    }

    const rootNode = graph.nodes[graph.root]
    if (!rootNode) {
      this.logger.error(`Graph "${graph.id}" root node "${graph.root}" not found`)
      return false
    }

    if (graph.fallbackNode && !graph.nodes[graph.fallbackNode]) {
      this.logger.error(`Graph "${graph.id}" fallback node "${graph.fallbackNode}" not found`)
      return false
    }

    const timeout = graph.timeout ?? this.defaultTimeout
    const state = this.graphStateService.create(
      message.from, bot.id, graph.id, graph.root, timeout,
      Date.now(), { __visitedNodes: [graph.root] }
    )

    this.logger.debug(`[new] graph="${graph.id}" root="${graph.root}" action="${rootNode.action}"`)
    this.logger.debug(`  message: "${message.content}" from "${message.from}"`)

    const rootConsumed = await this.executeNodeAction(bot, message, rootNode, {})
    if (!rootConsumed) {
      this.graphStateService.destroy(state.id)
      return false
    }

    return this.resolveFromActive(bot, message, state, graph)
  }

  private async handleActiveState(
    bot: Bot,
    message: IncomingMessage,
    state: GraphState
  ): Promise<boolean> {
    const graph = this.graphCatalog.get(state.graphId)
    if (!graph) {
      this.graphStateService.destroy(state.id)
      return false
    }

    const currentNode = graph.nodes[state.nodeId]
    if (!currentNode) {
      this.graphStateService.destroy(state.id)
      return false
    }

    this.logger.debug(`[active] graph="${graph.id}" node="${state.nodeId}" action="${currentNode.action}"`)
    this.logger.debug(`  message: "${message.content}" from "${message.from}"`)

    return this.resolveFromActive(bot, message, state, graph)
  }

  private async resolveFromActive(
    bot: Bot,
    message: IncomingMessage,
    state: GraphState,
    graph: GraphDef
  ): Promise<boolean> {
    const match = this.findBestEdge(graph, state, message.content)

    if (!match) {
      if (graph.fallbackNode && graph.nodes[graph.fallbackNode]) {
        await this.transitionToNode(bot, message, state, graph, graph.fallbackNode)
        return true
      }

      this.logger.debug(`  no edge matched, staying on node "${state.nodeId}"`)
      return true
    }

    this.logger.debug(`  >> goto="${match.edge.goto}" | node=${match.nodeIndex} score=${match.score.toFixed(3)}`)

    await this.transitionToNode(bot, message, state, graph, match.edge.goto)
    return true
  }

  private async transitionToNode(
    bot: Bot,
    message: IncomingMessage,
    state: GraphState,
    graph: GraphDef,
    nodeId: string
  ): Promise<void> {
    const node = graph.nodes[nodeId]
    if (!node) {
      this.logger.error(`Node "${nodeId}" not found in graph "${graph.id}"`)
      this.graphStateService.destroy(state.id)
      return
    }

    const vars = { ...state.variables }
    const visited: string[] = vars.__visitedNodes ?? []

    if (nodeId === graph.root) {
      vars.__visitedNodes = [graph.root]
    } else if (nodeId !== state.nodeId) {
      const prevNode = graph.nodes[state.nodeId]
      const hasNavEdges = prevNode?.edges.some(e => e.match && e.match.length > 0)

      if (hasNavEdges) {
        if (visited.includes(state.nodeId)) {
          const reordered = visited.filter(n => n !== state.nodeId)
          vars.__visitedNodes = [...reordered, state.nodeId]
        } else {
          vars.__visitedNodes = [...visited, state.nodeId]
        }
      }
    }

    await this.executeNodeAction(bot, message, node, vars)

    this.graphStateService.updateStep(state.id, nodeId, vars)
    this.logger.debug(`  visited updated: [${(vars.__visitedNodes ?? []).join(', ')}]`)
  }

  private findBestEdge(
    graph: GraphDef,
    state: GraphState,
    message: string
  ): EdgeMatch | null {
    const visited: string[] = state.variables?.__visitedNodes ?? []
    const currentNode = graph.nodes[state.nodeId]

    if (!currentNode) return null

    this.logger.debug(`  context: "${message}"`)
    this.logger.debug(`  current: ${state.nodeId} | visited: [${visited.join(', ')}]`)

    const nodes: { edges: Edge[]; nodeName: string }[] = []

    const allNodeNames = [...new Set([...visited, state.nodeId])]

    for (const nodeName of allNodeNames) {
      const node = graph.nodes[nodeName]
      if (node && nodeName !== state.nodeId) {
        nodes.push({ edges: node.edges, nodeName })
      }
    }

    nodes.push({ edges: currentNode.edges, nodeName: state.nodeId })

    let best: EdgeMatch | null = null

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]
      const edgeList = node.edges || []

      const condEdges = edgeList.filter(e => e.match && e.match.length > 0)

      if (condEdges.length === 0) {
        this.logger.debug(`    Node ${ni} ${node.nodeName}: 0 conditional edges`)
        continue
      }

      this.logger.debug(`    Node ${ni} ${node.nodeName} — ${condEdges.length} edges:`)

      for (let ei = 0; ei < condEdges.length; ei++) {
        const edge = condEdges[ei]
        const threshold = edge.fuzzyThreshold ?? 0.6

        const result = matchFuzzyVerbose(edge.match!, message, threshold)
        if (!result) {
          this.logger.debug(`      [${ei}] match="${edge.match}" → ${edge.goto}`)
          continue
        }

        const isBest = !best ||
          result.score < best.score ||
          (result.score === best.score && ni > best.nodeIndex)

        const marker = isBest ? '◀ BEST' : '◀ worse'
        this.logger.debug(`      [${ei}] match="${edge.match}" → ${edge.goto} | match="${result.match}" score=${result.score.toFixed(3)} ${marker}`)

        if (isBest) {
          best = { edge, score: result.score, nodeIndex: ni }
        }
      }
    }

    if (best) {
      this.logger.debug(`    >> winner: Node ${best.nodeIndex} goto="${best.edge.goto}" score=${best.score.toFixed(3)}`)
      return best
    }

    const defaultEdge = currentNode.edges.find(e => !e.match || e.match.length === 0)
    if (defaultEdge) {
      this.logger.debug(`    >> default → goto="${defaultEdge.goto}"`)
      return { edge: defaultEdge, score: 1, nodeIndex: nodes.length - 1 }
    }

    this.logger.debug(`    >> no match`)
    return null
  }

  private async executeNodeAction(
    bot: Bot,
    message: IncomingMessage,
    node: Node,
    variables: Record<string, any>
  ): Promise<boolean> {
    const context: ActionExecutionContext = {
      botId: bot.id,
      botName: bot.id,
      sender: message.from,
      senderName: message.senderName,
      message: message.content,
      variables,
    }

    if (this.isActionOnCooldown(bot, node.action, message.from)) {
      const action = getAction(this.actionCatalog, node.action)
      if (action.cooldownReply) {
        const reply = resolveVars(action.cooldownReply, context)
        this.outboxService.enqueue(bot.id, message.from, reply)
        this.logger.info(`Cooldown reply sent for action "${node.action}" to ${message.from}`)
        return true
      }
      this.logger.warn(`Action "${node.action}" on cooldown, no cooldown_reply defined, skipping`)
      return false
    }

    const result = executeAction(this.actionCatalog, node.action, context)
    this.setActionCooldown(node.action, message.from)

    if (result.reply) {
      this.outboxService.enqueue(bot.id, message.from, result.reply)
    }

    if (result.location) {
      this.outboxService.enqueue(
        bot.id,
        message.from,
        '',
        {
          type: 'location',
          latitude: result.location.latitude,
          longitude: result.location.longitude,
          name: result.location.name,
          address: result.location.address,
          url: result.location.url,
          description: result.location.description,
        }
      )
    }

    if (result.webhook) {
      try {
        const payload = this.buildWebhookPayload(bot, message, result.webhook.name || 'unnamed')
        await sendWebhookRequest({
          url: result.webhook.url,
          method: result.webhook.method,
          headers: result.webhook.headers,
          body: payload,
          timeout: result.webhook.timeout,
          retries: result.webhook.retries,
        })
      } catch (error) {
        this.logger.error(`Failed to trigger webhook action for bot "${bot.id}":`, error)
      }
    }

    return true
  }

  private isActionOnCooldown(bot: Bot, actionId: string, sender: string): boolean {
    if (!this.cooldownService) {
      return false
    }

    const action = getAction(this.actionCatalog, actionId)
    if (!action.cooldown || action.cooldown <= 0) {
      return false
    }

    const cooldownMs = action.cooldown * 1000
    const cooldownKey = `action:${actionId}`

    return this.cooldownService.isOnCooldown(sender, cooldownKey, cooldownMs)
  }

  private setActionCooldown(actionId: string, sender: string): void {
    if (!this.cooldownService) {
      return
    }

    const action = getAction(this.actionCatalog, actionId)
    if (!action.cooldown || action.cooldown <= 0) {
      return
    }

    this.cooldownService.setCooldown(sender, `action:${actionId}`)
  }

  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhookName: string): WebhookPayload {
    return {
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp.toISOString(),
      botId: bot.id,
      botName: bot.id,
      webhookName,
      metadata: message.metadata || {},
    }
  }
}
