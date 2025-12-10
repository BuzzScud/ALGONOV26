import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const distIndexHtml = join(distDir, 'index.html');

console.log('🔍 Verifying production build...\n');

try {
  // Check if dist/index.html exists
  if (!existsSync(distIndexHtml)) {
    console.error('❌ ERROR: dist/index.html does not exist!');
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  // Read the built index.html
  const indexHtml = readFileSync(distIndexHtml, 'utf-8');

  // Check for source file references (should NOT exist)
  const sourceFilePatterns = [
    /src="\.?\/?src\/main\.jsx"/i,
    /src=['"]\.?\/?src\/main\.jsx['"]/i,
    /src=.*main\.jsx/i,
  ];

  let hasSourceReference = false;
  for (const pattern of sourceFilePatterns) {
    if (pattern.test(indexHtml)) {
      hasSourceReference = true;
      console.error('❌ ERROR: dist/index.html contains source file reference!');
      console.error('   Found reference to main.jsx in the built file.');
      console.error('   This will cause "SyntaxError: Unexpected token \'<\'" in production.');
      console.error('\n   The built index.html should reference compiled JS files like:');
      console.error('   <script src="./assets/index-*.js"></script>');
      console.error('\n   NOT:');
      console.error('   <script src="./src/main.jsx"></script>');
      process.exit(1);
    }
  }

  // Check for compiled JS file references (should exist in assets/)
  // Matches both relative paths (./assets/) and absolute paths (/trading/dist/assets/)
  const compiledJsPattern = /src="[^"]*assets\/index-[^"]+\.js"/;
  if (!compiledJsPattern.test(indexHtml)) {
    console.warn('⚠️  Could not find JS file in dist/index.html');
    console.warn('   Checking for alternative patterns...');
  }

  // Extract and verify JS file exists - match any path ending in assets/index-*.js
  const jsMatch = indexHtml.match(/src="[^"]*assets\/(index-[^"]+\.js)"/);
  if (jsMatch) {
    const jsFilename = jsMatch[1];
    const jsPath = join(distDir, 'assets', jsFilename);
    
    if (!existsSync(jsPath)) {
      console.error(`❌ ERROR: Referenced JS file does not exist: assets/${jsFilename}`);
      console.error('   The build may be incomplete.');
      process.exit(1);
    }
    
    // Check if the JS file contains JSX (should NOT)
    const jsContent = readFileSync(jsPath, 'utf-8');
    if (jsContent.includes('<StrictMode>') || jsContent.includes('</StrictMode>')) {
      console.error('❌ ERROR: Compiled JS file contains JSX syntax!');
      console.error('   The file was not properly compiled/transpiled.');
      console.error('   This will cause "SyntaxError: Unexpected token \'<\'" in production.');
      process.exit(1);
    }
    
    console.log(`✅ Verified compiled JS file: assets/${jsFilename}`);
  }

  // Check for CSS file
  const cssPattern = /href="[^"]*assets\/index-[^"]+\.css"/;
  if (!cssPattern.test(indexHtml)) {
    console.warn('⚠️  WARNING: No compiled CSS file reference found.');
  } else {
    const cssMatch = indexHtml.match(/href="[^"]*assets\/(index-[^"]+\.css)"/);
    if (cssMatch) {
      const cssFilename = cssMatch[1];
      const cssPath = join(distDir, 'assets', cssFilename);
      if (existsSync(cssPath)) {
        console.log(`✅ Verified compiled CSS file: assets/${cssFilename}`);
      }
    }
  }

  console.log('\n✅ Build verification passed!');
  console.log('   The dist/ folder is ready for production deployment.');
  console.log('   Upload all contents of dist/ to your server.');

} catch (error) {
  console.error('❌ Error during build verification:', error.message);
  process.exit(1);
}
