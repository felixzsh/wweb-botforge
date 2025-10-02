import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface RawConfig {
  bots: (BotConfig | IncludeReference)[];
}

interface IncludeReference {
  '!include': string;
}

interface BotConfig {
  id: string;
  name: string;
  phone?: string;
  auto_responses?: any[];
  webhooks?: any[];
  settings?: any;
}

export class YamlLoader {
  private configPath: string;

  constructor(configPath: string = 'config/main.yml') {
    this.configPath = configPath;
  }

  async loadMainConfig(): Promise<RawConfig> {
    const content = fs.readFileSync(this.configPath, 'utf8');
    const processedContent = this.processIncludes(content, path.dirname(this.configPath));
    const mainConfig = yaml.load(processedContent) as { bots: any[] };

    // Validate configuration
    this.validateConfig(mainConfig);

    return { bots: mainConfig.bots };
  }

  private validateConfig(config: { bots: any[] }): void {
    if (!config.bots || !Array.isArray(config.bots)) {
      throw new Error('Configuration must contain a "bots" array');
    }

    for (const bot of config.bots) {
      if (!bot.id) {
        throw new Error('Each bot must have an "id"');
      }
      if (!bot.name) {
        throw new Error(`Bot ${bot.id} must have a "name"`);
      }
      // Add more validations as needed
    }
  }

  private processIncludes(content: string, baseDir: string): string {
    const lines = content.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const includeMatch = line.match(/^\s*-\s*!include\s+(.+)$/);
      if (includeMatch) {
        const includePath = path.resolve(baseDir, includeMatch[1]);
        const includedContent = fs.readFileSync(includePath, 'utf8');
        // Add the dash and indent the content
        const indent = line.match(/^\s*/)?.[0] || '';
        const indentedContent = includedContent
          .split('\n')
          .map((line, index) => index === 0 ? indent + '- ' + line : indent + '  ' + line)
          .join('\n');
        processedLines.push(indentedContent);
      } else {
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }
}