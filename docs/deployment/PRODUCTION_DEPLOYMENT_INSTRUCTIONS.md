# Production Deployment Instructions - Complete Guide

## 🎯 Critical Information: Frontend vs Backend

**IMPORTANT:** This is a **FRONTEND React application**. The files go in `/var/www/html/` (or your web root), NOT in `voynich-backend/`.

- ✅ **Frontend files** → `/var/www/html/` or `/var/www/html/trading/` (for subdirectory deployment)
- ❌ **NOT** → `/var/www/voynich-backend/` (that's for backend API services)

---

## 📋 Pre-Deployment Checklist

### Step 1: Fix Security Vulnerabilities

On your development machine:

```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# For vulnerabilities that require manual review
npm audit fix --force  # Use with caution - may update major versions
```

### Step 2: Build the Application

```bash
# Ensure you're in the project directory
cd "/Users/christiantavarez/Downloads/CODING /NOV 17 PROJECT"

# Install dependencies (if needed)
npm install

# Build for production
npm run build
```

**Expected Output:**
- Build completes successfully
- Creates `dist/` folder with compiled files
- Multiple chunk files (vendor-react, vendor-charts, vendor-pdf, etc.)
- `.htaccess` file is automatically updated with correct file paths

### Step 3: Verify Build Output

```bash
# Check dist/ folder contents
ls -la dist/

# Should see:
# - index.html
# - .htaccess (IMPORTANT!)
# - js/ folder (with multiple chunk files)
# - css/ folder
# - assets/ folder
```

---

## 🚀 Server Deployment Steps

### Step 1: Determine Deployment Location

**For root domain** (`https://yourdomain.com`):
- Upload to: `/var/www/html/`

**For subdirectory** (`https://yourdomain.com/trading/`):
- Upload to: `/var/www/html/trading/`

Based on your server structure (`/var/www/html/` exists), you likely want subdirectory deployment.

### Step 2: Upload Files to Server

**Method 1: Using SCP (from development machine)**

```bash
# For subdirectory deployment (/trading/)
scp -r dist/* user@yourdomain.com:/var/www/html/trading/

# CRITICAL: Upload .htaccess file (it's hidden)
scp dist/.htaccess user@yourdomain.com:/var/www/html/trading/

# For root deployment
scp -r dist/* user@yourdomain.com:/var/www/html/
scp dist/.htaccess user@yourdomain.com:/var/www/html/
```

**Method 2: Using SFTP**

1. Connect to server via SFTP
2. Navigate to `/var/www/html/`
3. Create `trading/` directory if it doesn't exist: `mkdir trading`
4. Upload ALL contents from `dist/` folder
5. **IMPORTANT:** Enable "Show hidden files" and upload `.htaccess`

### Step 3: Verify File Upload

**On the server, run:**

```bash
# Check files are uploaded correctly
ls -la /var/www/html/trading/

# Should see:
# - index.html
# - .htaccess (MUST be present!)
# - js/ directory
# - css/ directory
# - assets/ directory

# Verify .htaccess exists (it's hidden)
ls -la /var/www/html/trading/.htaccess
```

### Step 4: Set Correct Permissions

**On the server:**

```bash
# Navigate to deployment directory
cd /var/www/html/trading/  # or /var/www/html/ for root

# Set directory permissions (755 = rwxr-xr-x)
find . -type d -exec chmod 755 {} \;

# Set file permissions (644 = rw-r--r--)
find . -type f -exec chmod 644 {} \;

# Set ownership (replace www-data with apache if on CentOS/RHEL)
sudo chown -R www-data:www-data .

# Verify .htaccess permissions
ls -la .htaccess
# Should show: -rw-r--r-- 1 www-data www-data
```

### Step 5: Configure Apache

**Enable Required Modules:**

```bash
# Ubuntu/Debian
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod mime
sudo a2enmod deflate
sudo a2enmod expires
sudo systemctl restart apache2

# CentOS/RHEL/Amazon Linux
# Edit /etc/httpd/conf/httpd.conf and uncomment:
# LoadModule rewrite_module modules/mod_rewrite.so
# LoadModule headers_module modules/mod_headers.so
# LoadModule mime_module modules/mod_mime.so
# LoadModule deflate_module modules/mod_deflate.so
# LoadModule expires_module modules/mod_expires.so
sudo systemctl restart httpd
```

**Configure Virtual Host:**

Edit your Apache configuration:

```bash
# Ubuntu/Debian
sudo nano /etc/apache2/sites-available/000-default.conf

# CentOS/RHEL
sudo nano /etc/httpd/conf.d/yourdomain.conf
```

**Add/Verify Configuration:**

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    
    # For subdirectory deployment
    <Directory /var/www/html/trading>
        AllowOverride All
        Require all granted
        Options -Indexes +FollowSymLinks
        DirectoryIndex index.html
    </Directory>
    
    # OR for root deployment
    # DocumentRoot /var/www/html
    # <Directory /var/www/html>
    #     AllowOverride All
    #     Require all granted
    #     Options -Indexes +FollowSymLinks
    #     DirectoryIndex index.html
    # </Directory>
</VirtualHost>
```

**Test Configuration:**

```bash
# Test Apache configuration
sudo apache2ctl configtest  # Ubuntu/Debian
# OR
sudo httpd -t  # CentOS/RHEL

# Restart Apache if test passes
sudo systemctl restart apache2  # Ubuntu/Debian
# OR
sudo systemctl restart httpd  # CentOS/RHEL
```

---

## ✅ Verification Steps

### 1. Check Application Loads

```bash
# From server
curl -I http://localhost/trading/
# Should return: HTTP/1.1 200 OK

# From browser
# Visit: https://yourdomain.com/trading/
# Should see the application loading
```

### 2. Check Browser Console

Open browser DevTools (F12) and verify:
- ✅ No 404 errors for JS/CSS files
- ✅ No JavaScript syntax errors
- ✅ All chunks load correctly (vendor-react, vendor-charts, etc.)
- ✅ Application renders correctly

### 3. Test Routes

- ✅ Navigate between pages
- ✅ Direct URL access works (e.g., `/trading/news`)
- ✅ Browser refresh on routes doesn't show 404

### 4. Check Apache Logs

```bash
# Monitor error logs
sudo tail -f /var/log/apache2/error.log  # Ubuntu/Debian
# OR
sudo tail -f /var/log/httpd/error_log  # CentOS/RHEL

# Monitor access logs
sudo tail -f /var/log/apache2/access.log  # Ubuntu/Debian
```

---

## 🔧 Troubleshooting

### Issue: Blank Page

**Causes:**
- `.htaccess` file not uploaded or missing
- `mod_rewrite` not enabled
- `AllowOverride All` not set in Apache config

**Solution:**
```bash
# Verify .htaccess exists
ls -la /var/www/html/trading/.htaccess

# Check mod_rewrite enabled
apache2ctl -M | grep rewrite

# Verify Apache config
grep -r "AllowOverride" /etc/apache2/sites-available/
```

### Issue: 404 for JS/CSS Files

**Causes:**
- Files not uploaded correctly
- Wrong file paths in index.html
- .htaccess MIME types not working

**Solution:**
```bash
# Check file structure
ls -la /var/www/html/trading/js/
ls -la /var/www/html/trading/css/

# Verify index.html references
grep -o 'src="[^"]*"' /var/www/html/trading/index.html
```

### Issue: Routes Not Working (404 on Refresh)

**Causes:**
- React Router not configured correctly
- Apache rewrite rules not working

**Solution:**
```bash
# Verify .htaccess rewrite rules
grep -A 10 "mod_rewrite" /var/www/html/trading/.htaccess

# Test rewrite with curl
curl -I http://localhost/trading/nonexistent-route
# Should return index.html (200 OK), not 404
```

### Issue: Large Bundle Warning

**Solution:**
- Code splitting is now implemented
- Multiple vendor chunks will be created (vendor-react, vendor-charts, vendor-pdf, etc.)
- Browser will load chunks on-demand
- Initial load will be faster

---

## 📊 Expected Build Output After Code Splitting

After implementing code splitting, your build should produce:

```
dist/
├── index.html
├── .htaccess
├── js/
│   ├── vendor-react-[hash].js      (~45-50 KB)
│   ├── vendor-charts-[hash].js     (~200-250 KB)
│   ├── vendor-pdf-[hash].js        (~500-600 KB)
│   ├── vendor-lwc-[hash].js        (~200-300 KB)
│   ├── vendor-apex-[hash].js       (~150-200 KB)
│   ├── vendor-misc-[hash].js       (~100-150 KB)
│   └── index-[hash].js              (~100-150 KB)
├── css/
│   └── index-[hash].css             (~70 KB)
└── assets/
    └── vite-[hash].svg
```

**Benefits:**
- Initial load: Only vendor-react + index chunks (~150-200 KB)
- Charts load when needed: vendor-charts chunk
- PDF loads when needed: vendor-pdf chunk
- Faster page load times
- Better caching (chunks update independently)

---

## 🔄 Update Process

When deploying updates:

1. **Build new version:**
   ```bash
   npm run build
   ```

2. **Backup current version (optional but recommended):**
   ```bash
   ssh user@yourdomain.com
   sudo cp -r /var/www/html/trading /var/www/html/trading.backup-$(date +%Y%m%d)
   ```

3. **Upload new files:**
   ```bash
   scp -r dist/* user@yourdomain.com:/var/www/html/trading/
   scp dist/.htaccess user@yourdomain.com:/var/www/html/trading/
   ```

4. **Set permissions:**
   ```bash
   ssh user@yourdomain.com
   cd /var/www/html/trading
   sudo chown -R www-data:www-data .
   find . -type d -exec chmod 755 {} \;
   find . -type f -exec chmod 644 {} \;
   ```

5. **Clear browser cache** (users may need to do Ctrl+Shift+R)

---

## 📝 Summary

**Key Points:**
- ✅ Files go in `/var/www/html/trading/` (FRONTEND), NOT `/var/www/voynich-backend/`
- ✅ Build must be done BEFORE deployment (`npm run build`)
- ✅ `.htaccess` file is CRITICAL - must be uploaded
- ✅ Code splitting reduces initial load time
- ✅ Fix npm vulnerabilities before building
- ✅ Set correct file permissions (755 for dirs, 644 for files)
- ✅ Enable Apache modules (rewrite, headers, mime, deflate, expires)

Your application is now production-ready! 🚀

