#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

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

function main() {
  // We're being installed as a dependency
  const packageRoot = __dirname;
  // Copy from the compiled Angular app directory (now using dist/public which has the updated files)
  const sourceAngularDir = path.join(packageRoot, '..', 'dist', 'public');
  // Also copy static assets that Angular app needs (same directory now)
  const sourceAssetsDir = path.join(packageRoot, '..', 'dist', 'public');

  // Find the project root (where package.json is)
  let projectRoot = packageRoot;
  let depth = 0;
  while (depth < 10) {
    const parentDir = path.dirname(projectRoot);
    if (parentDir === projectRoot) break; // reached filesystem root

    projectRoot = parentDir;
    depth++;

    // Check if we're in node_modules and find the project root
    if (projectRoot.includes('node_modules')) {
      // Go up to find the actual project root
      const parts = projectRoot.split(path.sep);
      const nodeModulesIndex = parts.lastIndexOf('node_modules');
      if (nodeModulesIndex > 0) {
        projectRoot = parts.slice(0, nodeModulesIndex).join(path.sep);
        break;
      }
    }

    // Check if we found a project root
    if (fs.existsSync(path.join(projectRoot, 'package.json')) &&
        !projectRoot.includes('node_modules')) {
      break;
    }
  }

  // Install into project-level public_templates so runtime can serve templates from there       
  const targetDir = path.join(projectRoot, 'public_templates', 'threejs-ui');

  // Check if sources exist
  const angularExists = fs.existsSync(sourceAngularDir);
  const assetsExists = fs.existsSync(sourceAssetsDir);

  if (!angularExists && !assetsExists) {
    console.log('‚ö†Ô∏è  ThreeJS UI assets not found in package, skipping copy');
    return;
  }

  console.log('Ì≥¶ Installing ThreeJS UI application and assets...');
  console.log(`   Angular App: ${sourceAngularDir} (${angularExists ? 'found' : 'missing'})`);   
  console.log(`   Static Assets: ${sourceAssetsDir} (${assetsExists ? 'found' : 'missing'})`);   
  console.log(`   Target: ${targetDir}`);

  try {
    // Remove existing directory
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy Angular application (main app files) - now directly from dist/public
    if (angularExists) {
      copyDirectory(sourceAngularDir, targetDir);
      console.log('‚úÖ Angular application copied from dist/public');
    }

    // Since both sourceAngularDir and sourceAssetsDir point to the same location now,
    // we don't need to copy assets separately as they're already included above

  console.log('‚úÖ ThreeJS UI application and assets installed successfully!');
  console.log(`Ì≥ç Application available at: ${targetDir}`);
  console.log('ÌæÆ You can now use provideTemplate: true (served from public_templates/threejs-ui) in your ThreeJS UI configuration');                                                             
  } catch (error) {
    console.error('‚ùå Error installing ThreeJS UI application:', error.message);
    // Don't fail the install if asset copy fails
    process.exit(0);
  }
}

// Only run if this script is executed directly during npm install
if (require.main === module) {
  main();
}
