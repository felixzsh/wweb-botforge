#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function uninstallService() {
  if (os.platform() !== 'linux') return;

  const isRoot = process.getuid && process.getuid() === 0;
  const homeDir = os.homedir();

  const userServicePath = path.join(homeDir, '.config', 'systemd', 'user', 'botforje-js.service');
  const userConfigDir = path.join(homeDir, '.config', 'botforje-js');
  const systemServicePath = '/etc/systemd/system/botforje-js.service';
  const systemConfigDir = '/etc/botforje-js';

  const isUserService = fs.existsSync(userServicePath);
  const isSystemService = fs.existsSync(systemServicePath);

  if (!isUserService && !isSystemService) return;

  const scopeFlag = isUserService ? '--user ' : '';
  const scope = isUserService ? 'user' : 'system';
  const servicePath = isUserService ? userServicePath : systemServicePath;
  const configDir = isUserService ? userConfigDir : systemConfigDir;

  console.log('\nUninstalling Botforje-js service...\n');

  try {
    console.log('  Stopping service...');
    execSync(`systemctl ${scopeFlag}stop botforje-js 2>/dev/null`, { stdio: 'inherit', timeout: 10000 });
  } catch {
    console.log('  (service was not running)');
  }

  try {
    execSync(`systemctl ${scopeFlag}disable botforje-js 2>/dev/null`, { stdio: 'ignore' });
  } catch {}

  fs.unlinkSync(servicePath);
  console.log('  Service file removed');

  execSync(`systemctl ${scopeFlag}daemon-reload`, { stdio: 'ignore' });

  console.log(`\n  Config kept at: ${configDir}`);
  console.log(`  To remove:      rm -rf ${configDir}\n`);
}

uninstallService();
