import { Bot } from '../bot'
import { IncomingMessage } from '../messages/contracts'
import { RequestPayload } from '../actions/request'
import { ActionCatalog, ActionExecutionContext, ActionStep, ActionDef, resolveAction } from '../actions/action'
import { GraphCatalog, GraphDef, Node, Edge, GraphState } from './graph'
import { resolveVars } from '../actions/action'
import { GraphStateService } from './state'
import { OutboxService } from '../messages/outbox'
import { CooldownService } from '../actions/cooldown'
import { sendRequest } from '../actions/request'
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

    const action = resolveAction(this.actionCatalog, node.action)

    if (this.isActionOnCooldown(action, message.from)) {
      const onBlockedExecutedKey = `on_blocked.executed:${action.id}`
      const cooldown = action.guards?.cooldown

      if (cooldown && this.cooldownService?.isOnCooldown(message.from, onBlockedExecutedKey, cooldown.duration * 1000)) {
        this.logger.debug(`  on_blocked pipeline already ran this cooldown for action "${node.action}", skipping`)
        return true
      }

      const onBlocked = action.guards?.cooldown?.onBlocked
      if (onBlocked && onBlocked.length > 0) {
        for (const step of onBlocked) {
          await this.runStep(bot, message, step, context)
        }
        this.cooldownService?.setCooldown(message.from, onBlockedExecutedKey)
        this.logger.info(`Cooldown on_blocked pipeline ran for action "${node.action}" to ${message.from}`)
      } else {
        this.logger.warn(`Action "${node.action}" on cooldown, no on_blocked defined, skipping`)
      }
      return true
    }

    for (const step of action.steps) {
      await this.runStep(bot, message, step, context)
    }

    this.setActionCooldown(action, message.from)
    this.cooldownService?.removeCooldown(message.from, `on_blocked.executed:${action.id}`)

    return true
  }

  private async runStep(
    bot: Bot,
    message: IncomingMessage,
    step: ActionStep,
    context: ActionExecutionContext
  ): Promise<void> {
    if ('message' in step) {
      const to = step.message.to ? resolveVars(step.message.to, context) : message.from
      const text = resolveVars(step.message.body, context)
      this.outboxService.enqueue(bot.id, to, text)
      this.logger.debug(`  message step → to=${to} text="${text.substring(0, 40)}"`)
      return
    }

    if ('location' in step) {
      this.outboxService.enqueue(
        bot.id,
        message.from,
        '',
        {
          type: 'location',
          latitude: step.location.latitude,
          longitude: step.location.longitude,
          name: step.location.name,
          address: step.location.address,
          url: step.location.url,
          description: step.location.description,
        }
      )
      this.logger.debug(`  location step → lat=${step.location.latitude} lng=${step.location.longitude}`)
      return
    }

    if ('request' in step) {
      try {
        const payload = this.buildRequestPayload(bot, message, step.request.name || 'unnamed')
        const resolvedUrl = resolveVars(step.request.url, context)
        await sendRequest({
          url: resolvedUrl,
          method: step.request.method,
          headers: step.request.headers,
          body: payload,
          timeout: step.request.timeout,
          retries: step.request.retries,
        })
      } catch (error) {
        this.logger.error(`Failed to execute request step for bot "${bot.id}":`, error)
      }
      return
    }
  }

  private isActionOnCooldown(action: ActionDef, sender: string): boolean {
    if (!this.cooldownService) {
      return false
    }

    const cooldown = action.guards?.cooldown
    if (!cooldown || cooldown.duration <= 0) {
      return false
    }

    const cooldownMs = cooldown.duration * 1000
    const cooldownKey = `action:${action.id}`

    return this.cooldownService.isOnCooldown(sender, cooldownKey, cooldownMs)
  }

  private setActionCooldown(action: ActionDef, sender: string): void {
    if (!this.cooldownService) {
      return
    }

    const cooldown = action.guards?.cooldown
    if (!cooldown || cooldown.duration <= 0) {
      return
    }

    this.cooldownService.setCooldown(sender, `action:${action.id}`)
  }

  private buildRequestPayload(bot: Bot, message: IncomingMessage, requestName: string): RequestPayload {
    return {
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp.toISOString(),
      botId: bot.id,
      botName: bot.id,
      requestName,
      metadata: message.metadata || {},
    }
  }
}
