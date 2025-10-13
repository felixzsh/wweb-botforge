#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function uninstallService() {
  if (os.platform() !== 'linux') return;

  try {
    const homeDir = os.homedir();
    const servicePath = path.join(homeDir, '.config', 'systemd', 'user', 'wweb-botforge.service');
    const configDir = path.join(homeDir, '.config', 'wweb-botforge');

    if (!fs.existsSync(servicePath)) return;

    console.log('\n🗑️  Uninstalling WWeb BotForge service...\n');

    // Stop service first to prevent hanging
    console.log('🛑 Stopping service...');
    try {
      execSync('systemctl --user stop wweb-botforge 2>/dev/null', { stdio: 'inherit', timeout: 10000 });
    } catch (error) {
      console.log('⚠️  Service may not be running or failed to stop gracefully');
    }

    // Disable service
    try {
      execSync('systemctl --user disable wweb-botforge 2>/dev/null', { stdio: 'ignore' });
    } catch {}

    // Eliminar archivo .service
    fs.unlinkSync(servicePath);
    console.log('✅ Service removed');

    // Recargar systemd
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    
    console.log(`\n💾 Configuration kept at: ${configDir}`);
    console.log(`   To remove: rm -rf ${configDir}\n`);

  } catch (error) {
    console.error('⚠️  Cleanup warning:', error.message);
  }
}

uninstallService();