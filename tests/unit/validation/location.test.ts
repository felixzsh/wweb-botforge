import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { validateConfig } from '../../../src/config/validation'

async function setupTempConfig(configContent: string, actionFiles: Record<string, string>): Promise<{ tmpDir: string; configPath: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'botforge-loc-test-'))
  const configPath = path.join(tmpDir, 'config.yml')
  await fs.writeFile(configPath, configContent, 'utf-8')

  const actionsDir = path.join(tmpDir, 'actions')
  await fs.mkdir(actionsDir, { recursive: true })
  for (const [name, content] of Object.entries(actionFiles)) {
    await fs.writeFile(path.join(actionsDir, `${name}.yml`), content, 'utf-8')
  }

  return { tmpDir, configPath }
}

async function cleanup(tmpDir: string): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true })
}

const baseConfig = `bots:
  test-bot:
    graph: any-graph
    settings:
      queue_delay: 1000
graphs:
  any-graph:
    root: start
    nodes:
      start:
        action: any-action
        edges: []
`

describe('Location action validation', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) {
      await cleanup(tmpDir)
      tmpDir = ''
    }
  })

  it('accepts a valid location-only action', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'send-store': `steps:
  - location:
      latitude: 19.4326
      longitude: -99.1332
      name: Store
      address: Reforma 123
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    const locationErrors = result.errors.filter(e => e.message.includes('location'))
    expect(locationErrors).toHaveLength(0)
  })

  it('accepts a valid reply + location action', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'send-office': `steps:
  - message:
      text: "Here is our office."
  - location:
      latitude: 19.4326
      longitude: -99.1332
      name: Office
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    const locationErrors = result.errors.filter(e => e.message.includes('location'))
    expect(locationErrors).toHaveLength(0)
  })

  it('rejects missing latitude', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      longitude: -99.1332
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => e.message.includes('latitude'))).toBe(true)
  })

  it('rejects missing longitude', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: 19.4326
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => e.message.includes('longitude'))).toBe(true)
  })

  it('rejects non-numeric latitude', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: "north"
      longitude: -99.1332
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => e.message.includes('latitude'))).toBe(true)
  })

  it('rejects latitude above 90', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: 91
      longitude: 0
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /latitude must be between/.test(e.message))).toBe(true)
  })

  it('rejects latitude below -90', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: -91
      longitude: 0
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /latitude must be between/.test(e.message))).toBe(true)
  })

  it('rejects longitude above 180', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: 0
      longitude: 181
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /longitude must be between/.test(e.message))).toBe(true)
  })

  it('rejects longitude below -180', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: 0
      longitude: -181
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /longitude must be between/.test(e.message))).toBe(true)
  })

  it('rejects non-string name', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location:
      latitude: 0
      longitude: 0
      name: 123
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /location\.name/.test(e.message))).toBe(true)
  })

  it('rejects location that is not an object', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'bad-loc': `steps:
  - location: "not an object"
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /location must be an object/.test(e.message))).toBe(true)
  })

  it('rejects action with no steps and no on_blocked', async () => {
    const { tmpDir: dir, configPath } = await setupTempConfig(baseConfig, {
      'empty-action': `guards:
  cooldown:
    duration: 30
`,
    })
    tmpDir = dir

    const result = await validateConfig(configPath)

    expect(result.errors.some(e => /Action must define steps/.test(e.message))).toBe(true)
  })
})
