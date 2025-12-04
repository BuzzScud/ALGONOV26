# 🚀 Quick Start Guide - ALGO-1 Apache Deployment

## ⚡ 3-Step Deployment

### Step 1: Upload Files
Upload the entire `ALGO-1-APACHE-READY` folder to your web server's public directory (e.g., `/var/www/html/`)

**Important:** Make sure ALL `.htaccess` files are uploaded (they may be hidden)

### Step 2: Set Permissions
```bash
cd /var/www/html/ALGO-1-APACHE-READY
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;
sudo chown -R www-data:www-data .  # Ubuntu/Debian
# OR
sudo chown -R apache:apache .      # CentOS/RHEL
```

### Step 3: Test
Visit your website: `http://yourdomain.com`

✅ **Done!** Your site should now work.

---

## 🔧 If You See a Blank Page

### Check 1: Browser Console
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Look for errors (404, 403, CORS, etc.)

### Check 2: Verify .htaccess Files
```bash
ls -la .htaccess
ls -la css/.htaccess
ls -la js/.htaccess
ls -la images/.htaccess
```

All should exist. If missing, re-upload them.

### Check 3: Apache Modules
```bash
# Check if required modules are enabled
apache2ctl -M | grep -E 'rewrite|headers|mime|deflate|expires'

# Enable if missing
sudo a2enmod rewrite headers mime deflate expires
sudo systemctl restart apache2
```

### Check 4: Virtual Host Configuration
Edit your Apache config and ensure:
```apache
<Directory /var/www/html/ALGO-1-APACHE-READY>
    AllowOverride All
    Require all granted
</Directory>
```

Then restart Apache:
```bash
sudo systemctl restart apache2
```

---

## 📁 Directory Structure

```
ALGO-1-APACHE-READY/
├── index.html          ← Main entry point
├── .htaccess          ← Main Apache config (IMPORTANT!)
├── css/
│   ├── .htaccess      ← CSS config (IMPORTANT!)
│   └── *.css
├── js/
│   ├── .htaccess      ← JS config (IMPORTANT!)
│   └── *.js
├── images/
│   ├── .htaccess      ← Images config (IMPORTANT!)
│   └── *.svg, *.png, etc.
├── fonts/
│   └── .htaccess      ← Fonts config (IMPORTANT!)
└── docs/
    ├── .htaccess      ← Docs config (IMPORTANT!)
    └── *.pdf
```

---

## 🎯 What the .htaccess Files Do

### Main .htaccess
- ✅ Enables directory access
- ✅ Sets correct MIME types for all files
- ✅ Enables GZIP compression (70-80% size reduction)
- ✅ Configures browser caching
- ✅ Adds security headers
- ✅ Enables React Router (SPA routing)
- ✅ Fixes permission issues

### Directory-Specific .htaccess Files
Each directory (css/, js/, images/, fonts/, docs/) has its own .htaccess that:
- ✅ Grants access to files in that directory
- ✅ Sets correct MIME types
- ✅ Enables compression
- ✅ Configures caching

**This is why the blank page issue is fixed!**

---

## 🔍 Common Issues & Quick Fixes

### Issue: 500 Internal Server Error
**Fix:** Check Apache error log
```bash
tail -f /var/log/apache2/error.log
```
Usually means AllowOverride is not set to All.

### Issue: 403 Forbidden
**Fix:** Check permissions
```bash
chmod 755 /var/www/html/ALGO-1-APACHE-READY
chmod -R 644 /var/www/html/ALGO-1-APACHE-READY/*
chmod -R 755 /var/www/html/ALGO-1-APACHE-READY/*/
```

### Issue: 404 for JS/CSS Files
**Fix:** Verify files exist and .htaccess files are present
```bash
ls -la js/
ls -la css/
cat js/.htaccess
cat css/.htaccess
```

### Issue: Styles Not Loading
**Fix:** Check MIME type in browser Network tab
Should be `text/css` for CSS files and `application/javascript` for JS files.

If wrong, check that mod_mime is enabled:
```bash
apache2ctl -M | grep mime
```

---

## 🧪 Test Your Deployment

### 1. Visual Test
- ✅ Page loads (no blank screen)
- ✅ Dashboard visible
- ✅ Navigation works
- ✅ Styles applied correctly

### 2. Browser Console Test (F12)
- ✅ No 404 errors
- ✅ No 403 errors
- ✅ No CORS errors
- ✅ All files load with 200 status

### 3. Network Tab Test (F12 → Network)
- ✅ All resources load successfully
- ✅ GZIP compression active (Content-Encoding: gzip)
- ✅ Cache headers present

### 4. Performance Test
```bash
# Test GZIP compression
curl -H "Accept-Encoding: gzip" -I http://yourdomain.com/js/index-Bc9BTIyR.js

# Should show: Content-Encoding: gzip
```

---

## 📚 Full Documentation

For detailed information, see:
- **README.md** - Complete overview and troubleshooting
- **APACHE_DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions
- **FIXES_APPLIED.md** - Technical details of fixes (in parent directory)

---

## 🆘 Still Having Issues?

1. **Check Apache error logs:**
   ```bash
   tail -f /var/log/apache2/error.log
   ```

2. **Test Apache configuration:**
   ```bash
   apache2ctl configtest
   ```

3. **Verify all modules are enabled:**
   ```bash
   apache2ctl -M
   ```

4. **Check file permissions:**
   ```bash
   ls -la
   ```

5. **Clear browser cache:**
   Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Website loads without blank page
- ✅ Dashboard displays with content
- ✅ Navigation sidebar appears
- ✅ No errors in browser console
- ✅ All pages accessible
- ✅ Styles and scripts load correctly

---

## 📞 Need More Help?

Review the comprehensive guides:
1. **README.md** - Overview and troubleshooting
2. **APACHE_DEPLOYMENT_GUIDE.md** - Detailed deployment steps
3. Check Apache documentation
4. Contact your hosting provider

---

**Remember:** The .htaccess files are the key to fixing the blank page issue. Make sure they're all uploaded and have correct permissions!