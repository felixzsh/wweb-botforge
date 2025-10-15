#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

function setupSystemd() {
  try {
    if (os.platform() !== 'linux') {
      console.log('⚠️  Systemd setup is only available on Linux');
      return;
    }

    const user = os.userInfo().username;
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.config', 'wweb-botforge');
    const systemdUserDir = path.join(homeDir, '.config', 'systemd', 'user');
    
    const globalNpmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const scriptDir = path.dirname(__filename);
    const projectRoot = path.resolve(scriptDir, '..');

    // Detect mode: If project root is within global npm root, it's production
    const isProduction = projectRoot.startsWith(globalNpmRoot);
    const installDir = isProduction
      ? path.join(globalNpmRoot, 'wweb-botforge')
      : projectRoot;

    // For Node path, use 'which node' in both cases, but log a warning for dev
    const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
    if (!isProduction) {
      console.log('🔧 Development mode detected: Using local paths for testing');
      console.log(`   Install dir: ${installDir}`);
      console.log(`   Node path: ${nodePath}`);
      console.log('   Note: Ensure dist/cli/index.js exists (run build first)');
    }

    console.log('🔧 Setting up WWeb BotForge systemd service...');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`✅ Created config directory: ${configDir}`);
    }

    // Create example config file only if config.yml doesn't exist
    const exampleConfigPath = path.join(__dirname, '..', 'config.example.yml');
    const targetConfigPath = path.join(configDir, 'config.yml');

    if (fs.existsSync(exampleConfigPath) && !fs.existsSync(targetConfigPath)) {
      const exampleContent = fs.readFileSync(exampleConfigPath, 'utf8');
      // Comment out all lines for the default config
      const commentedContent = exampleContent
        .split('\n')
        .map(line => line.trim() ? `# ${line}` : line)
        .join('\n');
      fs.writeFileSync(targetConfigPath, commentedContent);
      console.log(`✅ Created example config file: ${targetConfigPath}`);
      console.log(`   📝 Uncomment and edit this file to configure your bots`);
    } else if (fs.existsSync(targetConfigPath)) {
      console.log(`ℹ️  Config file already exists: ${targetConfigPath}`);
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
    console.log('✅ Reloaded systemd daemon\n');

  } catch (error) {
    console.error('❌ Error setting up systemd service:', error.message);
    throw error;
  }
}

setupSystemd();