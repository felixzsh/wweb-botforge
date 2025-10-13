#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

console.log('\n🚀 Setting up WWeb BotForge...\n');

function hasSystemd() {
  if (os.platform() !== 'linux') return false;
  try {
    execSync('systemctl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (hasSystemd()) {
  try {
    console.log('📦 Detected Linux system with systemd');
    console.log('🔧 Configuring systemd service automatically...\n');
    
    const setupScript = path.join(__dirname, 'setup-systemd.js');
    execSync(`node "${setupScript}"`, { stdio: 'inherit' });
    
    console.log('✅ Installation complete!\n');
    console.log('🎯 Quick Start:\n');
    console.log('  1. Create a bot:     botforge create-bot');
    console.log('  2. Start service:    systemctl --user start wweb-botforge');
    console.log('  3. Enable on boot:   systemctl --user enable wweb-botforge');
    console.log('  4. Check status:     systemctl --user status wweb-botforge');
    console.log('  5. View logs:        journalctl --user -u wweb-botforge -f\n');
    
  } catch (error) {
    console.error('⚠️  Automatic setup failed:', error.message);
    console.log('\n💡 You can set it up manually: botforge setup\n');
    process.exit(0);
  }
} else {
  console.log('ℹ️  Systemd not detected (macOS/Windows/Container)');
  console.log('\n🎯 To use WWeb BotForge:\n');
  console.log('  1. Create a bot:     botforge create-bot');
  console.log('  2. Run manually:     botforge start\n');
}