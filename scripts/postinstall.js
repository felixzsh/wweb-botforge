#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('\n🚀 Running post-installation setup for WWeb BotForge...\n');

try {
  const setupScript = path.join(__dirname, 'setup-systemd.js');
  execSync(`node ${setupScript}`, { stdio: 'inherit' });
} catch (error) {
  console.error('⚠️  Post-install setup encountered an issue');
  console.log('You can run setup manually later with: botforge setup');
}

console.log('\n💡 Quick Start:');
console.log('  1. Create your first bot: botforge create-bot');
console.log('  2. Start the service:     systemctl --user start wweb-botforge');
console.log('  3. Check status:          systemctl --user status wweb-botforge\n');