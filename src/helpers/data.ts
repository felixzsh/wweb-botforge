import * as path from 'path'
import * as os from 'os'

export function getDataDir(): string {
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
  return path.join(dataHome, 'botdeck')
}
