# Fix: main.jsx Not Loading in Debugger

## Problem
When trying to debug `main.jsx` from the production site (`voynich.online/trading/`), the file doesn't load because:
1. **Production builds have source maps disabled** (for smaller bundle size)
2. **Source files aren't on the production server** (only built files are deployed)
3. **VS Code can't map breakpoints** without source maps

## ✅ Solution: Debug Locally, Not Production

**For debugging, always use localhost, not production:**

### Step 1: Start Local Dev Server
```bash
npm run dev
```

### Step 2: Use VS Code Debug Configuration
1. Open VS Code
2. Go to **Run and Debug** (Ctrl+Shift+D / Cmd+Shift+D)
3. Select **"Debug React App (Vite) - Localhost"**
4. Press **F5**

This will:
- ✅ Start Vite dev server on `http://localhost:5173`
- ✅ Launch Chrome with debugging enabled
- ✅ Load `main.jsx` and all source files correctly
- ✅ Enable breakpoints in all your source files

## Why Production Debugging Doesn't Work

Production builds are **optimized and minified**:
- Source maps are **disabled** (saves ~50% bundle size)
- Source files (`src/main.jsx`) are **not deployed** to server
- Only built files (`dist/assets/index-*.js`) are on production

**You cannot debug production code** without source maps and source files.

## If You Must Debug Production (Not Recommended)

### Option 1: Enable Source Maps for Production Build

1. Edit `vite.config.js`:
```js
build: {
  sourcemap: true, // or 'inline' - enables source maps
  // ... rest of config
}
```

2. Rebuild and redeploy:
```bash
npm run build
# Upload dist/ folder to server
```

3. **Warning:** This increases bundle size significantly and exposes source code structure.

### Option 2: Use Production Preview Locally

1. Build with source maps:
```bash
npm run build
```

2. Preview locally:
```bash
npm run preview
```

3. Use VS Code debugger with "Debug Production Build - Preview" configuration

## Recommended Workflow

1. **Develop and debug locally** using `npm run dev`
2. **Test production build locally** using `npm run preview`
3. **Deploy to production** only after everything works locally

## Quick Test

1. **Stop any running dev server**
2. **Set a breakpoint** in `src/main.jsx` (line 6-7)
3. **Press F5** and select "Debug React App (Vite) - Localhost"
4. **Breakpoint should hit** when app loads
5. You can now step through code, inspect variables, etc.

## Troubleshooting

### Breakpoints Still Grey?
- ✅ Make sure you're debugging **localhost**, not production
- ✅ Restart VS Code after configuration changes
- ✅ Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- ✅ Verify dev server is running on port 5173

### Can't Find main.jsx?
- ✅ Make sure you're using "Debug React App (Vite) - Localhost"
- ✅ Check that `src/main.jsx` exists in your project
- ✅ Verify the file is saved

### Source Maps Not Working?
- ✅ Source maps are **automatically enabled** in Vite dev mode
- ✅ No configuration needed for localhost debugging
- ✅ Check browser DevTools → Sources tab to see source files

---

**Remember:** Always debug locally (`localhost:5173`), not production (`voynich.online/trading/`)

