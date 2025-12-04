# ⚠️ CRITICAL: Deployment Checklist

## The Error You're Seeing

The browser is trying to load `https://voynich.online/src/main.jsx` which means **the wrong files are on your server**.

## Root Cause

Your server is serving the **source `index.html`** file instead of the **built `dist/index.html`** file.

## ✅ Solution

### Step 1: Verify Local Build
```bash
npm run build
```

### Step 2: Check dist/index.html
The built `index.html` should reference:
- `./assets/index-*.js` (NOT `/src/main.jsx`)
- `./assets/index-*.css`

### Step 3: Upload ONLY dist/ Contents
**CRITICAL:** Upload **ONLY** the contents of the `dist/` folder to `/trading/` on your server:

```
✅ CORRECT - Upload these files:
/trading/
├── index.html          ← Built version (references ./assets/)
├── .htaccess
├── vite.svg
└── assets/
    ├── index-*.js
    ├── index-*.css
    └── ...

❌ WRONG - DO NOT upload:
├── src/               ← Source files (NOT needed)
├── package.json       ← NOT needed
├── vite.config.js     ← NOT needed
└── index.html (root)  ← Source version (references /src/main.jsx)
```

### Step 4: Verify File Contents on Server

After uploading, check that `/trading/index.html` contains:
```html
<script type="module" crossorigin src="./assets/index-*.js"></script>
```

**NOT:**
```html
<script type="module" src="/src/main.jsx"></script>
```

## Quick Fix Commands

### On Your Server:
```bash
# Navigate to your web root
cd /path/to/web/root

# Remove old files (backup first!)
rm -rf trading/*

# Upload ONLY dist/ contents
# (Use FTP/SFTP to upload dist/ folder contents)
```

### Verify Upload:
```bash
# Check index.html on server
cat /path/to/web/root/trading/index.html | grep "script"

# Should show: src="./assets/index-*.js"
# Should NOT show: src="/src/main.jsx"
```

## Common Mistakes

1. ❌ Uploading entire project folder
2. ❌ Uploading `src/` folder
3. ❌ Uploading root `index.html` instead of `dist/index.html`
4. ❌ Not uploading `assets/` folder
5. ❌ Missing `.htaccess` file

## Verification Checklist

After uploading, verify:
- [ ] `/trading/index.html` exists
- [ ] `/trading/index.html` references `./assets/` (relative paths)
- [ ] `/trading/assets/` folder exists
- [ ] `/trading/assets/index-*.js` files exist
- [ ] `/trading/.htaccess` exists
- [ ] Browser console shows no 404 errors
- [ ] All assets load from `./assets/` path

## Test URLs

After correct deployment:
- ✅ `https://voynich.online/trading/` should load
- ✅ `https://voynich.online/trading/assets/index-*.js` should return 200 OK
- ❌ `https://voynich.online/src/main.jsx` should NOT be requested

---

**Remember:** Only upload the `dist/` folder contents, not the source files!

