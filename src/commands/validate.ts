import { validateConfig } from '../validation/validate'
import { setConfigPath } from '../config/yaml'

export async function runValidate(configPath?: string) {
  if (configPath) setConfigPath(configPath)

  const result = await validateConfig(configPath)

  if (result.valid) {
    console.log('Config OK')
    return
  }

  for (const err of result.errors) {
    const location = err.line ? `${err.file}:${err.line}` : err.file
    console.log(`${location}: ${err.message}`)
  }

  process.exit(1)
}
