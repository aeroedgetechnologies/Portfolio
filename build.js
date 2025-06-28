const { build } = require('vite');
const path = require('path');
const fs = require('fs');

async function buildApp() {
  try {
    console.log('Starting build...');
    
    // Ensure dist directory exists
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    await build({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      mode: 'production',
      build: {
        outDir: 'dist',
        emptyOutDir: true
      }
    });
    
    console.log('Build completed successfully!');
    console.log('Output directory:', distDir);
    
    // Verify the dist directory has files
    const files = fs.readdirSync(distDir);
    console.log('Files in dist:', files);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildApp(); 