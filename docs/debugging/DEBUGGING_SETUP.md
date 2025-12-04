# VS Code Debugging Setup for React + Vite

## ✅ Fixed: Source Maps Configuration

The breakpoint issue has been fixed by:
1. **Enabled source maps** in `vite.config.js` for development
2. **Created VS Code launch configurations** in `.vscode/launch.json`
3. **Added tasks** for automatic dev server startup

## How to Debug

### Option 1: Launch Chrome (Recommended)
1. Open VS Code
2. Go to Run and Debug (Ctrl+Shift+D / Cmd+Shift+D)
3. Select **"Debug React App (Vite)"** from the dropdown
4. Press F5 or click the green play button
5. VS Code will:
   - Start the Vite dev server automatically
   - Launch Chrome with debugging enabled
   - Connect breakpoints to your source files

### Option 2: Attach to Running Chrome
1. Start dev server manually: `npm run dev`
2. Launch Chrome with debugging: 
   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   
   # Windows
   chrome.exe --remote-debugging-port=9222
   
   # Linux
   google-chrome --remote-debugging-port=9222
   ```
3. In VS Code, select **"Attach to Chrome"** and press F5

### Option 3: Launch Chrome against localhost
1. Make sure dev server is running: `npm run dev`
2. Select **"Launch Chrome against localhost"** and press F5

## Setting Breakpoints

Now you can set breakpoints in:
- ✅ `src/main.jsx`
- ✅ `src/App.jsx`
- ✅ Any component in `src/components/`
- ✅ Any page in `src/pages/`
- ✅ Any service in `src/services/`

Breakpoints will be **active** (filled red circle) instead of grey/unbound.

## Source Maps Configuration

### Development Mode
- Source maps are **automatically enabled** by Vite
- Type: `inline` (embedded in the bundle)
- Breakpoints work immediately

### Production Build
- Source maps are **disabled** by default (smaller bundle size)
- To enable for production debugging, change in `vite.config.js`:
  ```js
  sourcemap: true, // or 'inline' or 'hidden'
  ```

## Troubleshooting

### Breakpoints Still Grey?
1. **Restart VS Code** after configuration changes
2. **Clear browser cache** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Verify source maps** are enabled:
   - Check Network tab in DevTools
   - Look for `.map` files or inline source maps
4. **Check launch.json** configuration matches your setup

### Can't Connect to Chrome?
1. Make sure Chrome is launched with `--remote-debugging-port=9222`
2. Check if port 9222 is available: `lsof -i :9222`
3. Try the "Launch Chrome" option instead of "Attach"

### Source Maps Not Loading?
1. Check `vite.config.js` has `sourcemap: 'inline'` or `true` for dev
2. Verify Vite dev server is running
3. Check browser console for source map errors
4. Ensure files are saved before setting breakpoints

## Configuration Files

### `.vscode/launch.json`
Contains 4 debug configurations:
- **Launch Chrome against localhost** - Basic launch
- **Attach to Chrome** - Attach to running Chrome
- **Debug React App (Vite)** - Recommended, auto-starts dev server
- **Debug Production Build** - For debugging built app

### `.vscode/tasks.json`
Defines tasks for:
- Starting Vite dev server
- Starting Vite preview server

### `vite.config.js`
- Source maps enabled for development
- Server configured for debugging
- Port 5173 (default Vite port)

## Quick Test

1. Set a breakpoint in `src/main.jsx` (line 6-7)
2. Press F5 and select "Debug React App (Vite)"
3. Breakpoint should hit when the app loads
4. You can now step through code, inspect variables, etc.

---

**Note:** Source maps are automatically enabled in Vite dev mode. The configuration ensures VS Code can properly map breakpoints to your source files.

