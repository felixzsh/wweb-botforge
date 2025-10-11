#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function setupSystemd() {
  try {
    if (os.platform() !== 'linux') {
      console.log('⚠️  Systemd setup is only available on Linux');
      console.log('ℹ️  You can still run: botforge start');
      return;
    }

    const user = os.userInfo().username;
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.config', 'wweb-botforge');
    const systemdUserDir = path.join(homeDir, '.config', 'systemd', 'user');
    
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const installDir = path.join(npmRoot, 'wweb-botforge');
    
    const nodePath = execSync('which node', { encoding: 'utf8' }).trim();

    console.log('🔧 Setting up WWeb BotForge systemd service...');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`✅ Created config directory: ${configDir}`);
    }

    if (!fs.existsSync(systemdUserDir)) {
      fs.mkdirSync(systemdUserDir, { recursive: true });
      console.log(`✅ Created systemd user directory: ${systemdUserDir}`);
    }

    const templatePath = path.join(__dirname, '..', 'templates', 'wweb-botforge.service.template');
    let serviceContent = fs.readFileSync(templatePath, 'utf8');

    serviceContent = serviceContent
      .replace(/{{USER}}/g, user)
      .replace(/{{INSTALL_DIR}}/g, installDir)
      .replace(/{{NODE_PATH}}/g, nodePath)
      .replace(/{{CONFIG_DIR}}/g, configDir);

    const servicePath = path.join(systemdUserDir, 'wweb-botforge.service');
    fs.writeFileSync(servicePath, serviceContent);
    console.log(`✅ Created service file: ${servicePath}`);

    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    console.log('✅ Reloaded systemd user daemon');

    console.log('\n✨ Setup complete!\n');
    console.log('📋 Available commands:');
    console.log('  • Start service:    systemctl --user start wweb-botforge');
    console.log('  • Stop service:     systemctl --user stop wweb-botforge');
    console.log('  • Restart service:  systemctl --user restart wweb-botforge');
    console.log('  • Check status:     systemctl --user status wweb-botforge');
    console.log('  • View logs:        journalctl --user -u wweb-botforge -f');
    console.log('  • Enable on boot:   systemctl --user enable wweb-botforge');
    console.log('  • Disable on boot:  systemctl --user disable wweb-botforge\n');

  } catch (error) {
    console.error('❌ Error setting up systemd service:', error.message);
    console.log('\nℹ️  You can still run the bot manually with: botforge start');
    process.exit(0);
  }
}

setupSystemd();