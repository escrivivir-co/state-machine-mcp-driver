#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function main() {
  const projectRoot = path.dirname(__dirname);
  const nodeModulesPath = path.join(projectRoot, 'node_modules', 'threejs-gamification-ui');
  // Use public_templates as the new target for Angular template assets
  const publicPath = path.join(projectRoot, 'public_templates', 'threejs-ui');
  
  console.log('🔧 Setting up ThreeJS Gamification UI...');
  
  // Check if the package is installed
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  threejs-gamification-ui package not found in node_modules');
    console.log('   Installing from local directory...');
    
    // Try to copy directly from local build
    const localBuildPath = path.join(projectRoot, '..', 'threejs-gamify-ui', 'dist', 'public');
    if (fs.existsSync(localBuildPath)) {
      console.log(`📦 Copying assets from local build: ${localBuildPath}`);
      try {
        if (fs.existsSync(publicPath)) {
          fs.rmSync(publicPath, { recursive: true, force: true });
        }
        copyDirectory(localBuildPath, publicPath);
        console.log('✅ ThreeJS UI setup completed successfully from local build!');
        console.log(`📍 Assets copied to: ${publicPath}`);
        return;
      } catch (error) {
        console.error('❌ Error copying from local build:', error.message);
      }
    }
    
    console.log('❌ No local build found either. Please run:');
    console.log('   cd ../threejs-gamify-ui && npm run build');
    return;
  }
  
  // Check if assets exist in the package
  const packageAssetsPath = path.join(nodeModulesPath, 'dist', 'public');
  if (!fs.existsSync(packageAssetsPath)) {
    console.log('⚠️  Assets not found in package. Package may not be built properly.');
    return;
  }
  
    // Create public_templates directory if it doesn't exist
  if (!fs.existsSync(path.join(projectRoot, 'public_templates'))) {
    fs.mkdirSync(path.join(projectRoot, 'public_templates'), { recursive: true });
  }
  
  // Copy assets to public_templates/threejs-ui
  console.log(`📦 Copying assets from package to ${publicPath}`);
  
  try {
    if (fs.existsSync(publicPath)) {
      fs.rmSync(publicPath, { recursive: true, force: true });
    }
    
    copyDirectory(packageAssetsPath, publicPath);
    
    console.log('✅ ThreeJS UI setup completed successfully!');
    console.log(`📍 Assets copied to: ${publicPath}`);
    console.log('🎮 You can now use provideTemplate: true in your configuration');
    
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    process.exit(1);
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
