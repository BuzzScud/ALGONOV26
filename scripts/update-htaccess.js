import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const distIndexHtml = join(distDir, 'index.html');
const htaccessPath = join(rootDir, '.htaccess');
const publicHtaccessPath = join(rootDir, 'public', '.htaccess');

try {
  // Read the built index.html to extract the JS filename
  const indexHtml = readFileSync(distIndexHtml, 'utf-8');
  
  // Extract the JS filename from the script tag (supports both absolute /js/ and relative ./js/ paths)
  const jsMatch = indexHtml.match(/src="\.?\/?js\/(index-[^"]+\.js)"/);
  
  if (!jsMatch) {
    console.warn('⚠️  Could not find JS file in dist/index.html');
    process.exit(0);
  }
  
  const jsFilename = jsMatch[1];
  console.log(`✅ Found JS file: /js/${jsFilename}`);
  
  // Read the .htaccess file
  let htaccess = readFileSync(htaccessPath, 'utf-8');
  let publicHtaccess = readFileSync(publicHtaccessPath, 'utf-8');
  
  // Update the redirect rule with the new JS filename
  // Pattern matches both absolute (/js/) and relative (js/) paths
  const oldPattern = /RewriteRule \^\.\*\$ \/?js\/index-[^ ]+\.js \[L\]/;
  const newRule = `RewriteRule ^.*$ js/${jsFilename} [L]`;
  
  if (oldPattern.test(htaccess)) {
    htaccess = htaccess.replace(oldPattern, newRule);
    writeFileSync(htaccessPath, htaccess, 'utf-8');
    console.log(`✅ Updated .htaccess with js/${jsFilename}`);
  } else {
    console.warn('⚠️  Could not find rewrite rule pattern in .htaccess');
  }
  
  if (oldPattern.test(publicHtaccess)) {
    publicHtaccess = publicHtaccess.replace(oldPattern, newRule);
    writeFileSync(publicHtaccessPath, publicHtaccess, 'utf-8');
    console.log(`✅ Updated public/.htaccess with js/${jsFilename}`);
  } else {
    console.warn('⚠️  Could not find rewrite rule pattern in public/.htaccess');
  }
  
  // Also update the .htaccess file in dist (copied from public during build)
  const distHtaccessPath = join(distDir, '.htaccess');
  if (existsSync(distHtaccessPath)) {
    try {
      let distHtaccess = readFileSync(distHtaccessPath, 'utf-8');
      if (oldPattern.test(distHtaccess)) {
        distHtaccess = distHtaccess.replace(oldPattern, newRule);
        writeFileSync(distHtaccessPath, distHtaccess, 'utf-8');
        console.log(`✅ Updated dist/.htaccess with js/${jsFilename}`);
      }
    } catch (err) {
      // Error reading/updating dist/.htaccess, that's okay
    }
  }
  
} catch (error) {
  console.error('❌ Error updating .htaccess:', error.message);
  process.exit(1);
}




