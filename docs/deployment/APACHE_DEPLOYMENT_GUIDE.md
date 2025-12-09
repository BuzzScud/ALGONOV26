# Apache Server Deployment Guide - Complete Instructions

## 🎯 Critical Understanding

**THIS APPLICATION MUST BE COMPILED BEFORE DEPLOYMENT**

- ❌ **DO NOT** upload source files (`.jsx`, `src/` folder) to the server
- ✅ **ONLY** upload the compiled files from the `dist/` folder
- The build process converts React JSX code into optimized static HTML, CSS, and JavaScript files
- Apache serves these static files directly - no server-side compilation needed

---

## 📋 Pre-Deployment Checklist

### 1. Build the Application (On Developer Machine)

```bash
# Navigate to project directory
cd /path/to/NOV-17-PROJECT

# Install dependencies (if not already installed)
npm install

# Build the application
npm run build
```

**What this does:**
- Compiles all React `.jsx` files into optimized JavaScript
- Bundles all CSS into production-ready files
- Optimizes assets (images, fonts, etc.)
- Creates static files in the `dist/` folder
- Updates `.htaccess` with correct file paths

**After build, you'll have:**
```
dist/
├── index.html          ← Main HTML file
├── .htaccess          ← Apache configuration (IMPORTANT!)
├── js/
│   └── index-*.js     ← Compiled JavaScript (hashed filename)
├── css/
│   └── index-*.css    ← Compiled CSS (hashed filename)
└── assets/
    └── *.svg, *.png   ← Static assets
```

---

## 🚀 Server Administrator Steps

### Step 1: Verify Apache Modules

Check which modules are enabled:

```bash
# Ubuntu/Debian
apache2ctl -M | grep -E 'rewrite|headers|mime|deflate|expires'

# CentOS/RHEL/Amazon Linux
httpd -M | grep -E 'rewrite|headers|mime|deflate|expires'
```

#### Enable Required Modules (if missing)

**Ubuntu/Debian:**
```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod mime
sudo a2enmod deflate
sudo a2enmod expires
sudo systemctl restart apache2
```

**CentOS/RHEL/Amazon Linux:**
```bash
# Edit /etc/httpd/conf/httpd.conf or appropriate config file
# Uncomment or add these lines:
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
LoadModule mime_module modules/mod_mime.so
LoadModule deflate_module modules/mod_deflate.so
LoadModule expires_module modules/mod_expires.so

# Restart Apache
sudo systemctl restart httpd
```

---

### Step 2: Configure Apache Virtual Host

#### For Root Domain Deployment (`https://yourdomain.com`)

**Ubuntu/Debian:**
```bash
sudo nano /etc/apache2/sites-available/000-default.conf
# or
sudo nano /etc/apache2/sites-available/yourdomain.conf
```

**CentOS/RHEL:**
```bash
sudo nano /etc/httpd/conf.d/yourdomain.conf
```

#### Add/Modify Virtual Host Configuration:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    
    # Document Root - Point to the dist/ folder contents
    DocumentRoot /var/www/html/your-app
    
    <Directory /var/www/html/your-app>
        # Allow .htaccess to override settings
        AllowOverride All
        
        # Allow access to all
        Require all granted
        
        # Enable directory indexing (optional)
        Options -Indexes +FollowSymLinks
        
        # Security: Prevent directory listing
        DirectoryIndex index.html
    </Directory>
    
    # Error and access logs
    ErrorLog ${APACHE_LOG_DIR}/yourdomain-error.log
    CustomLog ${APACHE_LOG_DIR}/yourdomain-access.log combined
</VirtualHost>
```

**Important:** Replace `/var/www/html/your-app` with your actual deployment path.

#### For Subdirectory Deployment (`https://yourdomain.com/trading/`)

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/html
    
    <Directory /var/www/html/trading>
        AllowOverride All
        Require all granted
        Options -Indexes +FollowSymLinks
        DirectoryIndex index.html
    </Directory>
</VirtualHost>
```

**Note:** For subdirectory deployment, ensure your build used `base: './'` in vite.config.js (already configured).

---

### Step 3: Upload Files to Server

#### Method 1: Using SCP (Secure Copy)

```bash
# From developer machine
scp -r dist/* user@yourdomain.com:/var/www/html/your-app/

# Make sure .htaccess is uploaded (it's a hidden file)
scp dist/.htaccess user@yourdomain.com:/var/www/html/your-app/
```

#### Method 2: Using SFTP/FTP

1. Upload **ALL contents** from the `dist/` folder to your web server directory
2. **CRITICAL:** Ensure `.htaccess` file is uploaded (it may be hidden - enable "Show hidden files")
3. Maintain the directory structure:
   - `index.html` at root
   - `js/` folder with JavaScript files
   - `css/` folder with CSS files
   - `assets/` folder with images, etc.
   - `.htaccess` at root

---

### Step 4: Set Correct File Permissions

```bash
# Navigate to your application directory
cd /var/www/html/your-app

# Set directory permissions (755 = rwxr-xr-x)
find . -type d -exec chmod 755 {} \;

# Set file permissions (644 = rw-r--r--)
find . -type f -exec chmod 644 {} \;

# Set ownership (replace www-data with apache if on CentOS/RHEL)
sudo chown -R www-data:www-data .

# Verify .htaccess exists and has correct permissions
ls -la .htaccess
# Should show: -rw-r--r-- 1 www-data www-data ... .htaccess
```

---

### Step 5: Verify Configuration

#### Test Apache Configuration Syntax

```bash
# Ubuntu/Debian
sudo apache2ctl configtest

# CentOS/RHEL
sudo httpd -t
```

**Expected output:** `Syntax OK`

If there are errors, fix them before proceeding.

#### Restart Apache

```bash
# Ubuntu/Debian
sudo systemctl restart apache2

# CentOS/RHEL
sudo systemctl restart httpd
```

---

## 🔍 Troubleshooting

### Issue 1: Blank Page / 500 Internal Server Error

**Check Apache Error Logs:**
```bash
# Ubuntu/Debian
sudo tail -f /var/log/apache2/error.log

# CentOS/RHEL
sudo tail -f /var/log/httpd/error_log
```

**Common Causes:**
- `.htaccess` file not uploaded
- `mod_rewrite` not enabled
- `AllowOverride All` not set in Apache config
- File permissions incorrect

**Solution:**
```bash
# Verify .htaccess exists
ls -la /var/www/html/your-app/.htaccess

# Check if mod_rewrite is enabled
apache2ctl -M | grep rewrite

# Verify AllowOverride in Apache config
grep -r "AllowOverride" /etc/apache2/sites-available/
```

---

### Issue 2: 404 Errors for JS/CSS Files

**Symptoms:**
- Page loads but no styling
- Browser console shows 404 for `.js` or `.css` files

**Common Causes:**
- Files not uploaded to correct directories
- `.htaccess` MIME type configuration missing
- File paths in `index.html` don't match actual file locations

**Solution:**
```bash
# Verify file structure
ls -la /var/www/html/your-app/js/
ls -la /var/www/html/your-app/css/

# Check index.html references
grep -o 'src="[^"]*"' /var/www/html/your-app/index.html

# Verify .htaccess has MIME type configuration
grep -A 5 "mod_mime" /var/www/html/your-app/.htaccess
```

---

### Issue 3: Routes Not Working (React Router)

**Symptoms:**
- Direct URL access to routes returns 404
- Browser refresh on route shows 404

**Cause:** Apache not rewriting routes to `index.html`

**Solution:**
```bash
# Verify mod_rewrite is enabled
apache2ctl -M | grep rewrite

# Check .htaccess rewrite rules
grep -A 10 "mod_rewrite" /var/www/html/your-app/.htaccess

# Should see:
# RewriteEngine On
# RewriteRule ^ index.html [L]
```

---

### Issue 4: JavaScript Not Executing (HTML Entity Encoding)

**Symptoms:**
- Browser shows JavaScript code as text
- Console errors about unexpected tokens

**Cause:** MIME type not set correctly

**Solution:**
- Verify `.htaccess` has MIME type configuration at the top
- Check `mod_mime` is enabled
- Verify Content-Type headers are set

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Application loads at `http://yourdomain.com`
- [ ] No console errors in browser DevTools (F12)
- [ ] CSS styling loads correctly
- [ ] JavaScript functionality works
- [ ] React Router routes work (navigation and direct URLs)
- [ ] Browser refresh on routes doesn't show 404
- [ ] Static assets (images, icons) load correctly
- [ ] `.htaccess` file is present in deployment directory
- [ ] Apache error logs show no errors
- [ ] File permissions are correct (755 for dirs, 644 for files)

---

## 🔄 Update Process (When Code Changes)

1. **Developer builds new version:**
   ```bash
   npm run build
   ```

2. **Server administrator uploads new `dist/` contents:**
   ```bash
   # Backup current version (optional but recommended)
   cp -r /var/www/html/your-app /var/www/html/your-app.backup-$(date +%Y%m%d)
   
   # Upload new files
   scp -r dist/* user@yourdomain.com:/var/www/html/your-app/
   scp dist/.htaccess user@yourdomain.com:/var/www/html/your-app/
   
   # Set permissions
   sudo chown -R www-data:www-data /var/www/html/your-app
   find /var/www/html/your-app -type d -exec chmod 755 {} \;
   find /var/www/html/your-app -type f -exec chmod 644 {} \;
   ```

3. **Clear browser cache** (users may need to do Ctrl+Shift+R / Cmd+Shift+R)

---

## 📝 Summary

**Key Points for Server Administrator:**
1. ✅ Only deploy files from `dist/` folder (compiled/built files)
2. ✅ Ensure `.htaccess` file is uploaded (hidden file)
3. ✅ Enable required Apache modules (rewrite, headers, mime, deflate, expires)
4. ✅ Set `AllowOverride All` in Apache config
5. ✅ Set correct file permissions (755 for directories, 644 for files)
6. ✅ Point DocumentRoot to the directory containing `index.html`

**What NOT to do:**
- ❌ Don't upload `src/` folder or `.jsx` files
- ❌ Don't install Node.js or npm on the server (not needed)
- ❌ Don't run `npm install` on the server
- ❌ Don't serve source files - they won't work in the browser

This is a **static site** - Apache simply serves HTML, CSS, and JavaScript files. No server-side processing required!

