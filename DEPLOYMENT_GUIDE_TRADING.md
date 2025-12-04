# Deployment Guide for /trading/ Subdirectory

## Quick Fix for https://voynich.online/trading/

### Step 1: Upload Files
Upload all contents from the `dist/` folder to your server's `/trading/` directory:
```
/trading/
├── index.html
├── assets/
│   ├── index-*.js
│   ├── index-*.css
│   └── ...
├── vite.svg
└── .htaccess  ← IMPORTANT: Upload this file!
```

### Step 2: Server Configuration

#### For Apache Servers:
1. **Upload `.htaccess` file** to the `/trading/` directory on your server
2. Ensure `mod_rewrite` is enabled:
   ```bash
   sudo a2enmod rewrite
   sudo systemctl restart apache2
   ```
3. Ensure `AllowOverride All` is set in your Apache config for the `/trading/` directory

#### For Nginx Servers:
Add this to your server block:
```nginx
location /trading/ {
    alias /path/to/your/trading/;
    try_files $uri $uri/ /trading/index.html;
}
```

### Step 3: Verify File Permissions
```bash
chmod 644 /path/to/trading/index.html
chmod 644 /path/to/trading/.htaccess
chmod -R 644 /path/to/trading/assets/
```

## Common Issues & Solutions

### Issue: Blank Page
**Cause:** Server not configured for SPA routing
**Solution:** 
- Ensure `.htaccess` is uploaded and `mod_rewrite` is enabled
- Check Apache error logs: `tail -f /var/log/apache2/error.log`

### Issue: 404 for Assets (JS/CSS files)
**Cause:** Incorrect paths or missing files
**Solution:**
- Verify all files from `dist/` are uploaded
- Check that assets are in `/trading/assets/` directory
- Verify file permissions

### Issue: Routes Not Working
**Cause:** React Router basename not detected correctly
**Solution:**
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for errors
- Verify `.htaccess` rewrite rules are working

### Issue: 500 Internal Server Error
**Cause:** Apache configuration issue
**Solution:**
- Check Apache error logs
- Verify `AllowOverride All` is set
- Test `.htaccess` syntax: `apachectl configtest`

## Testing Checklist

After deployment, test:
- [ ] `https://voynich.online/trading/` loads (Dashboard)
- [ ] `https://voynich.online/trading/news` works
- [ ] `https://voynich.online/trading/projection` works
- [ ] `https://voynich.online/trading/data` works
- [ ] Browser console shows no 404 errors
- [ ] All assets load (check Network tab)
- [ ] Navigation between pages works

## Browser Console Debugging

Open browser console (F12) and check:
1. **No 404 errors** for JS/CSS files
2. **No CORS errors**
3. **Check Network tab** - all files should load with 200 status
4. **Console log** should show: `Detected basename: /trading from path: /trading/`

## File Structure on Server

```
/var/www/html/trading/  (or your web root)
├── .htaccess           ← Must be here!
├── index.html
├── vite.svg
└── assets/
    ├── index-*.js
    ├── index-*.css
    └── ...
```

## Quick Test

After uploading, test with:
```bash
curl -I https://voynich.online/trading/
# Should return 200 OK

curl -I https://voynich.online/trading/assets/index-*.js
# Should return 200 OK (replace * with actual filename)
```

---

**Important:** The `.htaccess` file is critical for SPA routing to work. Make sure it's uploaded to the `/trading/` directory on your server!

