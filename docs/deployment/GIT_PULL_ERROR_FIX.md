# Fixing Git Pull Error on Server

## Understanding the Error

The error occurs because:
1. You're in `/var/www/html/trading/` directory
2. Local `.htaccess` files have uncommitted changes
3. Git won't overwrite these changes during pull

## ⚠️ Important: Production Directory Should NOT Be a Git Repo

**BEST PRACTICE:** The production web directory (`/var/www/html/trading/`) should contain **compiled files**, not the Git repository.

### Correct Deployment Workflow:

1. **Clone/Build in separate location** (e.g., `/home/buzzscud/trading-app/`)
2. **Build the application** (`npm run build`)
3. **Copy built files** from `dist/` to `/var/www/html/trading/`

---

## Quick Fix Options

### Option 1: Discard Local Changes (Recommended for Production)

If the local `.htaccess` changes aren't needed:

```bash
cd /var/www/html/trading/

# Discard local changes to .htaccess files
git restore .htaccess
git restore public/.htaccess

# Now pull the updates
git pull
```

### Option 2: Stash Local Changes

If you want to keep the changes for later:

```bash
cd /var/www/html/trading/

# Stash the local changes
git stash

# Pull the updates
git pull

# If needed, you can reapply later with: git stash pop
```

### Option 3: Commit Local Changes First

If the local changes are important:

```bash
cd /var/www/html/trading/

# Commit the local changes
git add .htaccess public/.htaccess
git commit -m "Local .htaccess changes"

# Pull (may require merge)
git pull
```

---

## Recommended: Proper Deployment Setup

### Step 1: Clone Repository to Separate Location

```bash
# On server, clone to home directory or /opt
cd ~
git clone https://github.com/BuzzScud/ALGONOV26.git trading-app
cd trading-app
```

### Step 2: Build Application

```bash
# Install dependencies (if needed)
npm install

# Build for production
npm run build
```

### Step 3: Deploy Built Files

```bash
# Copy built files to web directory
sudo cp -r dist/* /var/www/html/trading/

# Copy .htaccess (important!)
sudo cp dist/.htaccess /var/www/html/trading/

# Set correct permissions
sudo chown -R www-data:www-data /var/www/html/trading/
sudo find /var/www/html/trading/ -type d -exec chmod 755 {} \;
sudo find /var/www/html/trading/ -type f -exec chmod 644 {} \;
```

### Step 4: Update Process (Future Deployments)

```bash
# Update repository
cd ~/trading-app
git pull

# Rebuild
npm run build

# Deploy new build
sudo cp -r dist/* /var/www/html/trading/
sudo cp dist/.htaccess /var/www/html/trading/
sudo chown -R www-data:www-data /var/www/html/trading/
```

---

## Why This Approach is Better

1. **Separation of Concerns:** Source code separate from production files
2. **No Git Conflicts:** Production directory isn't a Git repo
3. **Clean Deployments:** Always deploy fresh built files
4. **Easy Rollback:** Can keep previous builds
5. **Security:** Source code not exposed in web directory

---

## Current Situation Fix

If you need to fix the current situation immediately:

```bash
# Option 1: Discard and pull
cd /var/www/html/trading/
git restore .htaccess public/.htaccess
git pull

# Option 2: Or if you want to keep it as a repo temporarily
cd /var/www/html/trading/
git stash
git pull
```

**Note:** After fixing, consider migrating to the proper deployment workflow above.

