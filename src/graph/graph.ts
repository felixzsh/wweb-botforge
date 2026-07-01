export interface Edge {
  match?: string[]
  fuzzyThreshold?: number
  goto: string
}

export interface Node {
  action: string
  edges: Edge[]
}

export interface GraphDef {
  id: string
  root: string
  timeout?: number
  fallbackNode?: string
  nodes: Record<string, Node>
}

export type GraphCatalog = Map<string, GraphDef>

export interface GraphExecutionContext {
  botId: string
  botName: string
  sender: string
  message: string
}

export interface GraphState {
  id: string
  sender: string
  botId: string
  graphId: string
  nodeId: string
  variables: Record<string, any>
  startedAt: number
  lastActivityAt: number
  timeout: number
}
