# Resolve Git Merge Conflict on Production Server

## Problem
You're getting "unmerged files" error when trying to pull/push on the production server.

## Solution Steps

### Step 1: Check Status
```bash
git status
```

This will show you which files have conflicts (marked with "both modified" or "unmerged paths").

### Step 2: View Conflicted Files
```bash
git diff --name-only --diff-filter=U
```

This lists all files with unresolved conflicts.

### Step 3: Resolve Conflicts

For each conflicted file, you have two options:

#### Option A: Accept Remote Version (Recommended for production)
If you want to use the remote version (from GitHub):
```bash
git checkout --theirs <filename>
git add <filename>
```

#### Option B: Accept Local Version
If you want to keep your local changes:
```bash
git checkout --ours <filename>
git add <filename>
```

#### Option C: Manual Resolution
If you need to manually edit the file:
1. Open the file in an editor
2. Look for conflict markers:
   ```
   <<<<<<< HEAD
   (your local changes)
   =======
   (remote changes)
   >>>>>>> branch-name
   ```
3. Edit the file to resolve the conflict (remove markers, keep desired code)
4. Save the file
5. Stage it: `git add <filename>`

### Step 4: Complete the Merge
After resolving all conflicts:
```bash
git commit -m "Resolve merge conflicts"
```

### Step 5: Pull and Push
```bash
git pull origin main
git push origin main
```

## Quick Fix (Accept Remote - Recommended)

If you want to accept all remote changes and discard local conflicts:

```bash
# Check which files are conflicted
git status

# For each conflicted file, accept remote version
git checkout --theirs .
git add .

# Complete the merge
git commit -m "Resolve merge conflicts - accept remote changes"

# Pull and push
git pull origin main
git push origin main
```

## Alternative: Reset and Pull (Use with Caution)

If you want to completely discard local changes and match remote:

```bash
# WARNING: This will discard all local changes
git fetch origin
git reset --hard origin/main
```

**⚠️ Only use this if you're sure you want to discard all local changes!**

## Common Conflicted Files

If you see conflicts in:
- `src/main.jsx` - Accept remote version (it has the latest improvements)
- `.htaccess` - Accept remote version (it's auto-updated by build script)
- `package.json` - May need manual review
- `dist/` files - These shouldn't be in git, can be ignored

## After Resolving

Once conflicts are resolved:
1. Make sure your production files are correct
2. Rebuild if needed: `npm run build`
3. Verify the app works correctly

