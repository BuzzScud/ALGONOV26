# Apache Deployment Guide - Complete Instructions

## 🎯 Overview

This guide provides step-by-step instructions for deploying the ALGO-1 application on an Apache web server with proper .htaccess configuration.

## 📋 Pre-Deployment Checklist

### Server Requirements
- [ ] Apache 2.4 or higher
- [ ] PHP 7.0+ (optional, for future enhancements)
- [ ] mod_rewrite enabled
- [ ] mod_headers enabled
- [ ] mod_mime enabled
- [ ] mod_deflate enabled
- [ ] mod_expires enabled
- [ ] AllowOverride All enabled in Apache config

### File Preparation
- [ ] All files downloaded/extracted
- [ ] Directory structure intact
- [ ] All .htaccess files present (including hidden ones)

## 🚀 Deployment Steps

### Step 1: Verify Apache Modules

#### Check Enabled Modules
```bash
# Ubuntu/Debian
apache2ctl -M | grep -E 'rewrite|headers|mime|deflate|expires'

# CentOS/RHEL
httpd -M | grep -E 'rewrite|headers|mime|deflate|expires'
```

#### Enable Required Modules (if not enabled)
```bash
# Ubuntu/Debian
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod mime
sudo a2enmod deflate
sudo a2enmod expires
sudo systemctl restart apache2

# CentOS/RHEL
# Edit /etc/httpd/conf/httpd.conf and uncomment:
# LoadModule rewrite_module modules/mod_rewrite.so
# LoadModule headers_module modules/mod_headers.so
# LoadModule mime_module modules/mod_mime.so
# LoadModule deflate_module modules/mod_deflate.so
# LoadModule expires_module modules/mod_expires.so
sudo systemctl restart httpd
```

### Step 2: Configure Apache Virtual Host

#### Edit Virtual Host Configuration

**Ubuntu/Debian:**
```bash
sudo nano /etc/apache2/sites-available/000-default.conf
```

**CentOS/RHEL:**
```bash
sudo nano /etc/httpd/conf.d/yourdomain.conf
```

#### Add/Modify Configuration
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    DocumentRoot /var/www/html/ALGO-1-APACHE-READY
    
    <Directory /var/www/html/ALGO-1-APACHE-READY>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/algo1-error.log
    CustomLog ${APACHE_LOG_DIR}/algo1-access.log combined
</VirtualHost>
```

#### For HTTPS (if SSL certificate is valid)
```apache
<VirtualHost *:443>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    DocumentRoot /var/www/html/ALGO-1-APACHE-READY
    
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key
    SSLCertificateChainFile /path/to/chain.crt
    
    <Directory /var/www/html/ALGO-1-APACHE-READY>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/algo1-ssl-error.log
    CustomLog ${APACHE_LOG_DIR}/algo1-ssl-access.log combined
</VirtualHost>
```

#### Restart Apache
```bash
# Ubuntu/Debian
sudo systemctl restart apache2

# CentOS/RHEL
sudo systemctl restart httpd
```

### Step 3: Upload Files

#### Option A: Using FTP/SFTP
1. Connect to your server using FileZilla, WinSCP, or similar
2. Navigate to your web root (e.g., `/var/www/html/`)
3. Upload the entire `ALGO-1-APACHE-READY` folder
4. Ensure all files and folders are uploaded, including hidden `.htaccess` files

#### Option B: Using SCP (from local machine)
```bash
scp -r ALGO-1-APACHE-READY user@yourserver.com:/var/www/html/
```

#### Option C: Using rsync (from local machine)
```bash
rsync -avz ALGO-1-APACHE-READY/ user@yourserver.com:/var/www/html/ALGO-1-APACHE-READY/
```

#### Option D: Direct on Server
```bash
# If you have the zip file on the server
cd /var/www/html/
unzip ALGO-1-APACHE-READY.zip
```

### Step 4: Set Correct Permissions

```bash
# Navigate to the directory
cd /var/www/html/ALGO-1-APACHE-READY

# Set directory permissions to 755
find . -type d -exec chmod 755 {} \;

# Set file permissions to 644
find . -type f -exec chmod 644 {} \;

# Set ownership to Apache user
# Ubuntu/Debian
sudo chown -R www-data:www-data .

# CentOS/RHEL
sudo chown -R apache:apache .
```

### Step 5: Verify .htaccess Files

```bash
# Check that all .htaccess files are present
cd /var/www/html/ALGO-1-APACHE-READY
ls -la .htaccess
ls -la css/.htaccess
ls -la js/.htaccess
ls -la images/.htaccess
ls -la fonts/.htaccess
ls -la docs/.htaccess
```

If any are missing, they may not have been uploaded (hidden files).

### Step 6: Test Apache Configuration

```bash
# Test configuration syntax
# Ubuntu/Debian
sudo apache2ctl configtest

# CentOS/RHEL
sudo httpd -t

# Should output: Syntax OK
```

If you see errors, review your virtual host configuration.

### Step 7: Test the Website

1. **Open Browser**
   - Navigate to: `http://yourdomain.com`
   - Or: `http://your-server-ip`

2. **Check for Blank Page**
   - Page should load with content
   - Dashboard should be visible
   - Navigation should work

3. **Open Browser Console** (F12)
   - Check Console tab for errors
   - Should see no 404 or 403 errors
   - All resources should load with 200 status

4. **Check Network Tab** (F12 → Network)
   - Verify all files load successfully
   - Check that GZIP compression is active (Content-Encoding: gzip)
   - Verify cache headers are set

## 🔍 Troubleshooting

### Issue 1: 500 Internal Server Error

**Cause:** .htaccess syntax error or unsupported directive

**Solution:**
```bash
# Check Apache error log
tail -f /var/log/apache2/error.log  # Ubuntu/Debian
tail -f /var/log/httpd/error_log    # CentOS/RHEL

# Test .htaccess syntax
cd /var/www/html/ALGO-1-APACHE-READY
sudo apache2ctl configtest
```

**Common fixes:**
- Ensure AllowOverride All is set in virtual host
- Check that all required modules are enabled
- Verify .htaccess syntax

### Issue 2: 403 Forbidden

**Cause:** Permission issues or directory access denied

**Solution:**
```bash
# Check permissions
ls -la /var/www/html/ALGO-1-APACHE-READY

# Fix permissions
sudo chmod 755 /var/www/html/ALGO-1-APACHE-READY
sudo chmod -R 755 /var/www/html/ALGO-1-APACHE-READY/*/
sudo chmod -R 644 /var/www/html/ALGO-1-APACHE-READY/*

# Fix ownership
sudo chown -R www-data:www-data /var/www/html/ALGO-1-APACHE-READY  # Ubuntu
sudo chown -R apache:apache /var/www/html/ALGO-1-APACHE-READY      # CentOS
```

### Issue 3: 404 Not Found for JS/CSS Files

**Cause:** Files not uploaded or incorrect paths

**Solution:**
```bash
# Verify files exist
ls -la /var/www/html/ALGO-1-APACHE-READY/js/
ls -la /var/www/html/ALGO-1-APACHE-READY/css/

# Check .htaccess files
cat /var/www/html/ALGO-1-APACHE-READY/js/.htaccess
cat /var/www/html/ALGO-1-APACHE-READY/css/.htaccess
```

### Issue 4: Blank Page (No Errors)

**Cause:** JavaScript not executing or React Router issues

**Solution:**
1. Check browser console for JavaScript errors
2. Verify mod_rewrite is enabled
3. Check that .htaccess rewrite rules are working
4. Clear browser cache (Ctrl+Shift+R)

```bash
# Test mod_rewrite
echo "RewriteEngine On" | sudo tee /var/www/html/test.htaccess
```

### Issue 5: Styles Not Applied

**Cause:** MIME type misconfiguration

**Solution:**
```bash
# Check CSS MIME type in browser Network tab
# Should be: text/css

# Verify mod_mime is enabled
apache2ctl -M | grep mime

# Check css/.htaccess
cat /var/www/html/ALGO-1-APACHE-READY/css/.htaccess
```

### Issue 6: GZIP Compression Not Working

**Cause:** mod_deflate not enabled or configured

**Solution:**
```bash
# Enable mod_deflate
sudo a2enmod deflate
sudo systemctl restart apache2

# Test compression
curl -H "Accept-Encoding: gzip" -I http://yourdomain.com/css/index-Ck2VMa9Q.css
# Should see: Content-Encoding: gzip
```

## 🔐 Security Hardening

### Additional Security Measures

1. **Disable Directory Listing** (already in .htaccess)
   ```apache
   Options -Indexes
   ```

2. **Protect Sensitive Files** (already in .htaccess)
   ```apache
   <FilesMatch "^\.">
       Require all denied
   </FilesMatch>
   ```

3. **Enable ModSecurity** (optional)
   ```bash
   sudo apt-get install libapache2-mod-security2
   sudo systemctl restart apache2
   ```

4. **Set Up Firewall**
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

5. **Regular Updates**
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```

## 📊 Performance Verification

### Test GZIP Compression
```bash
curl -H "Accept-Encoding: gzip" -I http://yourdomain.com/js/index-Bc9BTIyR.js
```
Should show: `Content-Encoding: gzip`

### Test Cache Headers
```bash
curl -I http://yourdomain.com/css/index-Ck2VMa9Q.css
```
Should show: `Cache-Control: public, max-age=31536000, immutable`

### Test Page Load Speed
Use tools like:
- Google PageSpeed Insights
- GTmetrix
- WebPageTest

Expected scores:
- PageSpeed: 90+
- Load time: < 2 seconds
- Compression: 70-80% reduction

## 🔄 Updating the Application

### To Update Files:
1. Upload new files to the server
2. Overwrite existing files
3. Clear browser cache
4. Test thoroughly

### To Update .htaccess:
1. Backup current .htaccess
   ```bash
   cp .htaccess .htaccess.backup
   ```
2. Upload new .htaccess
3. Test configuration
   ```bash
   sudo apache2ctl configtest
   ```
4. Restart Apache if needed

## 📝 Maintenance

### Regular Tasks:
1. **Monitor Error Logs**
   ```bash
   tail -f /var/log/apache2/error.log
   ```

2. **Check Disk Space**
   ```bash
   df -h
   ```

3. **Update Apache**
   ```bash
   sudo apt-get update && sudo apt-get upgrade apache2
   ```

4. **Backup Files**
   ```bash
   tar -czf algo1-backup-$(date +%Y%m%d).tar.gz /var/www/html/ALGO-1-APACHE-READY
   ```

## ✅ Final Checklist

After deployment, verify:

- [ ] Website loads without blank page
- [ ] No errors in browser console
- [ ] All navigation links work
- [ ] CSS styles are applied
- [ ] JavaScript is executing
- [ ] Images load correctly
- [ ] GZIP compression is active
- [ ] Cache headers are set
- [ ] Security headers are present
- [ ] No 404 or 403 errors
- [ ] React Router works (all routes accessible)
- [ ] Mobile responsive design works

## 🎉 Success!

If all checks pass, your ALGO-1 application is successfully deployed and optimized!

## 📞 Support Resources

- Apache Documentation: https://httpd.apache.org/docs/
- .htaccess Guide: https://httpd.apache.org/docs/current/howto/htaccess.html
- ModRewrite Guide: https://httpd.apache.org/docs/current/mod/mod_rewrite.html

---

**Note:** This guide assumes a standard Apache setup. Your specific server configuration may vary. Adjust paths and commands according to your server environment.