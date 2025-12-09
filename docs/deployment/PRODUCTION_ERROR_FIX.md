# Fix: SyntaxError: Unexpected token '<' in Production

## Problem
The production server is showing `SyntaxError: Unexpected token '<'` at `main.jsx:7`, which indicates the browser is trying to parse JSX as plain JavaScript.

## Root Cause
The production server is serving the **source `index.html`** file (which references `./src/main.jsx`) instead of the **built `dist/index.html`** file (which references compiled JavaScript).

## Quick Diagnosis

### Step 1: Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Reload the page
4. Look for `main.jsx` in the network requests

**If you see:**
- ❌ Request for `main.jsx` returns **JSX/HTML content** → Server is serving source files
- ❌ Request for `main.jsx` returns **404** → File doesn't exist on server
- ✅ Request for `js/index-*.js` returns **compiled JavaScript** → Correct!

### Step 2: Verify Local Build
```bash
npm run build
```

The build script now includes automatic verification. It will:
- ✅ Check that `dist/index.html` exists
- ✅ Verify it references compiled JS files (not `main.jsx`)
- ✅ Confirm compiled JS files exist and don't contain JSX
- ✅ Verify CSS files are present

### Step 3: Check Server Files
On your production server, verify `/trading/index.html` contains:
```html
<script type="module" crossorigin src="./js/index-*.js"></script>
```

**NOT:**
```html
<script type="module" src="./src/main.jsx"></script>
```

## Solution

### 1. Build the Application
```bash
npm run build
```

This will:
- Build the production bundle
- Update `.htaccess` files with correct JS filename
- Verify the build is correct

### 2. Upload ONLY dist/ Contents
**CRITICAL:** Upload **ONLY** the contents of the `dist/` folder to `/trading/` on your server:

```
✅ CORRECT - Upload these files:
/trading/
├── index.html          ← Built version (references ./js/index-*.js)
├── .htaccess           ← Apache configuration
├── vite.svg
├── assets/
│   └── vite-*.svg
├── css/
│   └── index-*.css
└── js/
    └── index-*.js      ← Compiled JavaScript (NOT JSX)
```

**❌ WRONG - DO NOT upload:**
- `src/` folder (source files)
- Root `index.html` (source version)
- `package.json`, `vite.config.js` (not needed in production)

### 3. Verify on Server
After uploading, check the server's `/trading/index.html`:
```bash
# Should show compiled JS reference
grep "script" /path/to/trading/index.html
# Output: <script type="module" crossorigin src="./js/index-*.js"></script>

# Should NOT show source file reference
grep "main.jsx" /path/to/trading/index.html
# Output: (should be empty)
```

### 4. Clear Browser Cache
After fixing, clear browser cache:
- **Chrome/Edge:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Firefox:** Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- Or use DevTools: Right-click refresh → "Empty Cache and Hard Reload"

## Prevention

The build process now includes automatic verification:
- ✅ Build script verifies no source file references in `dist/index.html`
- ✅ Checks that compiled JS files don't contain JSX syntax
- ✅ Confirms all required files exist

Run `npm run build` and it will catch these issues before deployment.

## Common Mistakes

1. ❌ **Uploading entire project folder** → Includes source files
2. ❌ **Uploading root `index.html`** → References `./src/main.jsx`
3. ❌ **Not clearing browser cache** → Browser serves old cached files
4. ❌ **Wrong directory on server** → Files in wrong location

## .htaccess Safeguard

The `.htaccess` file includes a redirect rule that catches any `/src/main.jsx` requests and redirects them to the compiled JS file. This provides a safety net, but the correct solution is to serve the right files from the start.

## Testing Locally

Before deploying, test the production build locally:
```bash
npm run build
cd dist
python3 -m http.server 8080
# or
npx serve -s dist
```

Visit `http://localhost:8080` and verify:
- ✅ No console errors
- ✅ App loads correctly
- ✅ Network tab shows compiled JS files (not `main.jsx`)

