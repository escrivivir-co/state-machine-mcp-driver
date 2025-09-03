#!/usr/bin/env node

/**
 * Script de verificación para la migración a public_templates
 * Verifica que los archivos estén en la ubicación correcta cuando provideTemplate=true
 */

const fs = require('fs');
const path = require('path');

function checkPath(filePath, description) {
  const exists = fs.existsSync(filePath);
  const icon = exists ? '✅' : '❌';
  console.log(`${icon} ${description}: ${filePath}`);
  return exists;
}

function main() {
  console.log('🔍 Verificando migración a public_templates...\n');
  
  // Proyecto state-machine-mcp-driver
  const projectRoot = path.resolve(process.cwd(), '../state-machine-mcp-driver');
  const publicTemplatesPath = path.join(projectRoot, 'public_templates', 'threejs-ui');
  const publicPath = path.join(projectRoot, 'public', 'threejs-ui'); // Ruta anterior
  
  console.log('📍 Rutas verificadas:');
  console.log(`   Project Root: ${projectRoot}`);
  console.log(`   Public Templates: ${publicTemplatesPath}`);
  console.log(`   Public (anterior): ${publicPath}\n`);
  
  // Verificar nueva ubicación
  console.log('🆕 Nueva ubicación (public_templates):');
  const newExists = checkPath(publicTemplatesPath, 'Directorio public_templates/threejs-ui');
  
  if (newExists) {
    checkPath(path.join(publicTemplatesPath, 'index.html'), 'index.html');
    checkPath(path.join(publicTemplatesPath, 'assets'), 'Carpeta assets');
    
    // Verificar archivos Angular típicos
    const files = fs.readdirSync(publicTemplatesPath);
    const hasMainJs = files.some(f => f.startsWith('main') && f.endsWith('.js'));
    const hasStylesCss = files.some(f => f.startsWith('styles') && f.endsWith('.css'));
    
    console.log(`${hasMainJs ? '✅' : '❌'} Archivo main.js encontrado`);
    console.log(`${hasStylesCss ? '✅' : '❌'} Archivo styles.css encontrado`);
  }
  
  // Verificar ubicación anterior (debería estar vacía o no existir)
  console.log('\n📁 Ubicación anterior (public):');
  const oldExists = checkPath(publicPath, 'Directorio public/threejs-ui (debería no existir)');
  
  if (oldExists) {
    console.log('⚠️  ADVERTENCIA: La ubicación anterior todavía existe. Considera eliminarla.');
  }
  
  // Verificar configuración en MultiUIGameManager
  console.log('\n⚙️  Verificando configuración:');
  const multiUIPath = path.join(projectRoot, 'src', 'ui', 'MultiUIGameManager.ts');
  if (fs.existsSync(multiUIPath)) {
    const content = fs.readFileSync(multiUIPath, 'utf8');
    const hasPublicTemplates = content.includes('public_templates/threejs-ui');
    const hasProvideTemplate = content.includes('provideTemplate');
    
    console.log(`${hasPublicTemplates ? '✅' : '❌'} Configuración public_templates encontrada`);
    console.log(`${hasProvideTemplate ? '✅' : '❌'} Configuración provideTemplate encontrada`);
  } else {
    console.log('❌ MultiUIGameManager.ts no encontrado');
  }
  
  // Resumen
  console.log('\n📋 Resumen:');
  if (newExists && !oldExists) {
    console.log('✅ Migración completada correctamente');
    console.log('🎮 Puedes usar provideTemplate: true en tu configuración');
  } else if (newExists && oldExists) {
    console.log('⚠️  Migración parcial - elimina la carpeta public/threejs-ui');
  } else {
    console.log('❌ Migración incompleta - ejecuta el postinstall o setup');
    console.log('💡 Comandos a ejecutar:');
    console.log('   cd ../state-machine-mcp-driver');
    console.log('   npm install threejs-gamification-ui');
    console.log('   # o ejecuta: node scripts/setup-threejs-ui.js');
  }
}

if (require.main === module) {
  main();
}
