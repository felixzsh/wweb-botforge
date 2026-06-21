export interface FuzzyTrigger {
  phrases: string[]
  fuzzyThreshold?: number
}

export interface FlowBranch {
  when?: string[]
  fuzzyThreshold?: number
  goto: string
}

export interface FlowStep {
  action: string
  branches: FlowBranch[]
}

export interface FlowDef {
  id: string
  name: string
  entryStep: string
  triggers?: FuzzyTrigger[]
  timeout?: number
  fallbackStep?: string
  steps: Record<string, FlowStep>
}

export type FlowCatalog = Map<string, FlowDef>

export interface FlowExecutionContext {
  botId: string
  botName: string
  sender: string
  message: string
}

export interface FlowState {
  id: string
  sender: string
  botId: string
  flowId: string
  stepId: string
  variables: Record<string, any>
  startedAt: number
  lastActivityAt: number
  timeout: number
}
