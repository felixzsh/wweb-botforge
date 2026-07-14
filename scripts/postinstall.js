#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const BANNER = `
  ██████   ██████  ████████ ███████  ██████  ██████   ██     ███████
  ██   ██ ██    ██    ██    ██      ██    ██ ██   ██ ███     ██
  ██████  ██    ██    ██    █████   ██    ██ ██████   ██     █████
  ██   ██ ██    ██    ██    ██      ██    ██ ██   ██  ██     ██
  ██████   ██████     ██    ██       ██████  ██   ██  ██     ███████
`;

console.log(BANNER);
console.log(`  Botforje v${require('../package.json').version} installed!\n`);

const scriptDir = __dirname;
const templatePath = path.join(scriptDir, '..', 'service', 'botforje.service.template');
const exampleConfigPath = path.join(scriptDir, '..', 'config.example.yml');

function renderServiceFile(template, vars) {
  return Object.entries(vars).reduce(
    (content, [key, value]) => content.replace(new RegExp(`{{${key}}}`, 'g'), value),
    template
  );
}

async function setupSystemd() {
  if (os.platform() !== 'linux') return 'no-systemd';

  try {
    require('child_process').execSync('systemctl --version', { stdio: 'ignore' });
  } catch {
    return 'no-systemd';
  }

  const isRoot = process.getuid && process.getuid() === 0;
  const homeDir = os.homedir();
  const nodePath = process.execPath;

  const nodeModulesDir = path.dirname(path.dirname(scriptDir));
  const pkgDir = path.resolve(scriptDir, '..');
  const scriptPath = path.join(pkgDir, 'dist', 'cli.js');

  if (!fs.existsSync(scriptPath)) {
    console.log('  (dist/cli.js not found — run "pnpm build" first for dev mode)\n');
    return 'dev-mode';
  }

  let serviceDir, configDir, scopeLabel, wantedBy;

  if (isRoot) {
    serviceDir = '/etc/systemd/system';
    configDir = '/etc/botforje';
    scopeLabel = 'system';
    wantedBy = 'multi-user.target';
  } else {
    serviceDir = path.join(homeDir, '.config', 'systemd', 'user');
    configDir = path.join(homeDir, '.config', 'botforje');
    scopeLabel = 'user';
    wantedBy = 'default.target';
  }

  // Create config directory
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Copy example config (commented) if config.yml doesn't exist
  const targetConfigPath = path.join(configDir, 'config.yml');
  if (fs.existsSync(exampleConfigPath) && !fs.existsSync(targetConfigPath)) {
    const exampleContent = fs.readFileSync(exampleConfigPath, 'utf8');
    const commentedContent = exampleContent
      .split('\n')
      .map(line => line.trim() ? `# ${line}` : line)
      .join('\n');
    fs.writeFileSync(targetConfigPath, commentedContent);
  }

  // Create service file
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const serviceContent = renderServiceFile(template, {
    NODE: nodePath,
    SCRIPT: scriptPath,
    WANTED_BY: wantedBy,
  });

  const servicePath = path.join(serviceDir, 'botforje.service');
  fs.writeFileSync(servicePath, serviceContent);

  return { scope: scopeLabel, configDir, servicePath, isRoot, homeDir };
}

async function main() {
  const result = await setupSystemd();

  if (result === 'no-systemd') {
    console.log('  (systemd not detected — run manually)\n');
    console.log('  ── Next steps ──\n');
    console.log('    Start daemon:       botforje daemon');
    console.log('    Authenticate:       botforje auth <botId>\n');
    return;
  }

  if (result === 'dev-mode') {
    console.log('  (dev mode — systemd service skipped)\n');
    console.log('  ── Next steps ──\n');
    console.log('    Build:              pnpm build');
    console.log('    Test daemon:        pnpm start daemon\n');
    return;
  }

  const { scope, configDir, servicePath, isRoot } = result;
  const scopeFlag = scope === 'user' ? '--user ' : '';

  console.log(`  Service file:   ${servicePath}`);
  console.log(`  Config dir:     ${configDir}\n`);

  if (scope === 'system') {
    console.log(`  ── Next steps ──\n`);
    console.log(`    Edit config:        ${configDir}/config.yml`);
    console.log(`    Start service:      systemctl enable --now botforje`);
    console.log(`    View logs:          journalctl -u botforje -f`);
    console.log(`    Authenticate:       sudo botforje auth <botId>\n`);
  } else {
    console.log(`  ── Next steps ──\n`);
    console.log(`    Edit config:        ${configDir}/config.yml`);
    console.log(`    Start service:      systemctl --user enable --now botforje`);
    console.log(`    View logs:          journalctl --user -u botforje -f`);
    console.log(`    Authenticate:       botforje auth <botId>\n`);
  }
}

main().catch(err => {
  console.error('postinstall error:', err.message);
  process.exit(0);
});
