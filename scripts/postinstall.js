#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

console.log('\nSetting up Botforje...\n');

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
    console.log('Detected Linux system with systemd');
    console.log('Configuring systemd service automatically...\n');
    
    const setupScript = path.join(__dirname, 'setup-systemd.js');
    execSync(`node "${setupScript}"`, { stdio: 'inherit' });
    
    console.log('Installation complete!\n');
    console.log('Quick Start:\n');
    console.log('  1. Start service:    systemctl --user start botforje');
    console.log('  2. Enable on boot:   systemctl --user enable botforje');
    console.log('  3. Check status:     botforje status');
    console.log('  4. Authenticate:     botforje auth <botId>');
    console.log('  5. View logs:        journalctl --user -u botforje -f\n');
    
  } catch (error) {
    console.error('Automatic setup failed:', error.message);
    console.log('\nYou can set it up manually: botforje setup\n');
    process.exit(0);
  }
} else {
  console.log('Systemd not detected (macOS/Windows/Container)');
  console.log('\nTo use Botforje:\n');
  console.log('\n  1. Start daemon:     botforje daemon');
  console.log('  2. Authenticate:     botforje auth <botId>\n');
}