import { FlowCatalog, FlowDef, FlowStep, FlowBranch, FuzzyTrigger } from './types'
import { FlowConfig, FlowStepConfig, FlowBranchConfig } from '../bot/types'

export function mapFlowCatalog(config: Record<string, FlowConfig>): FlowCatalog {
  const catalog: FlowCatalog = new Map()

  for (const [id, flowConfig] of Object.entries(config)) {
    catalog.set(id, mapFlow(id, flowConfig))
  }

  return catalog
}

function mapFlow(id: string, config: FlowConfig): FlowDef {
  if (!config.steps[config.entry_step]) {
    throw new Error(`Flow "${id}" entry step "${config.entry_step}" not found`)
  }

  const steps: Record<string, FlowStep> = {}
  for (const [stepId, stepConfig] of Object.entries(config.steps)) {
    steps[stepId] = mapStep(stepConfig)
  }

  if (config.fallback_step && !steps[config.fallback_step]) {
    throw new Error(`Flow "${id}" fallback step "${config.fallback_step}" not found`)
  }

  return {
    id,
    entryStep: config.entry_step,
    triggers: config.triggers ? mapTriggers(config.triggers) : undefined,
    timeout: config.timeout,
    fallbackStep: config.fallback_step,
    steps,
  }
}

function mapStep(config: FlowStepConfig): FlowStep {
  return {
    action: config.action,
    branches: (config.branches || []).map(mapBranch),
  }
}

function mapTriggers(
  triggers: string | string[] | Array<{ phrases: string | string[]; fuzzy_threshold?: number }>
): FuzzyTrigger[] {
  if (typeof triggers === 'string') {
    return [{ phrases: splitPhrases(triggers) }]
  }

  if (triggers.length === 0) {
    return []
  }

  if (typeof triggers[0] === 'string') {
    return (triggers as string[]).map(text => ({ phrases: splitPhrases(text) }))
  }

  return (triggers as Array<{ phrases: string | string[]; fuzzy_threshold?: number }>).map(item => ({
    phrases: typeof item.phrases === 'string'
      ? splitPhrases(item.phrases)
      : (item.phrases as string[]).flatMap(splitPhrases),
    fuzzyThreshold: item.fuzzy_threshold,
  }))
}

function mapBranch(config: FlowBranchConfig): FlowBranch {
  return {
    when: config.when ? mapWhen(config.when) : undefined,
    fuzzyThreshold: config.fuzzy_threshold,
    goto: config.goto,
  }
}

function mapWhen(when: string | string[]): string[] {
  if (typeof when === 'string') {
    return splitPhrases(when)
  }
  return when.flatMap(splitPhrases)
}

function splitPhrases(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
