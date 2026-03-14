# Deployment Setup Checklist

Use this checklist to set up your deployment pipeline from scratch.

## 📋 Pre-Deployment Setup

### 1. GitHub Repository Setup
- [ ] Repository created on GitHub
- [ ] Local repository connected to GitHub
  ```bash
  git remote -v  # Should show your GitHub repo
  ```

### 2. Configure GitHub Secrets (One-time setup)
- [ ] Navigate to: Settings > Secrets and variables > Actions
- [ ] Add all 9 required secrets (see list below)

**Quick Secret Verification:**
```
□ FIREBASE_PROJECT_ID = mezzters
□ FIREBASE_SERVICE_ACCOUNT = [JSON from Firebase Console]
□ VITE_FIREBASE_API_KEY = AIzaSyDml6waEHdDZiRhlO8T5SwgCAtHIP7viwA
□ VITE_FIREBASE_AUTH_DOMAIN = mezzters.firebaseapp.com
□ VITE_FIREBASE_PROJECT_ID = mezzters
□ VITE_FIREBASE_STORAGE_BUCKET = mezzters.firebasestorage.app
□ VITE_FIREBASE_MESSAGING_SENDER_ID = 724741628120
□ VITE_FIREBASE_APP_ID = 1:724741628120:web:ff86dcd83e2e03d2ce37ad
□ VITE_RAPIDAPI_API_KEY = [Your RapidAPI key]
```

**📖 Detailed Instructions:**
- [Visual Guide](./GITHUB_SECRETS_VISUAL_GUIDE.md) - Step-by-step with screenshots
- [Setup Guide](./SETUP_GITHUB_SECRETS.md) - Complete reference

### 3. Firebase Service Account (Special Step)
- [ ] Visit [Firebase Console](https://console.firebase.google.com/)
- [ ] Select "mezzters" project
- [ ] Go to: Settings (⚙️) > Project settings > Service accounts
- [ ] Click "Generate new private key"
- [ ] Download the JSON file
- [ ] Copy entire JSON contents
- [ ] Add as `FIREBASE_SERVICE_ACCOUNT` secret in GitHub

### 4. Local Development Setup
- [ ] Install dependencies: `npm install`
- [ ] Create `.env.local` from `.env.example`
- [ ] Test build locally: `npm run build`
- [ ] Verify no errors

---

## 🚀 First Deployment

### Pre-Flight Check
- [ ] All 9 GitHub secrets added
- [ ] Local build works (`npm run build`)
- [ ] Git working directory is clean
- [ ] On `main` branch

### Deploy Steps
```bash
# 1. Ensure you're on main
git checkout main

# 2. Pull latest (if working with team)
git pull origin main

# 3. Bump version
npm run version:bump:minor  # or patch/major

# 4. Commit version
git add package.json
git commit -m "Bump version to v1.0.0"

# 5. Push to trigger deployment
git push origin main
```

### Verify Deployment
- [ ] Go to GitHub > Actions tab
- [ ] See "Deploy to Firebase Hosting" workflow running
- [ ] Wait for green checkmark ✅
- [ ] Visit your Firebase Hosting URL
- [ ] Check version in footer (bottom right)
- [ ] Click version to see build timestamp

---

## 🔄 Regular Deployment Workflow

### Before Making Changes
- [ ] Create feature branch: `git checkout -b feature/my-feature`
- [ ] Make your changes
- [ ] Test locally: `npm run dev`
- [ ] Build test: `npm run build`

### Deploying Changes
```bash
# 1. Commit your changes
git add .
git commit -m "Description of changes"

# 2. Push feature branch
git push origin feature/my-feature

# 3. Create Pull Request on GitHub
# PR checks will run automatically

# 4. After PR approval, merge to main
# This triggers automatic deployment

# 5. Optionally bump version before merge
npm run version:bump:patch
git add package.json
git commit -m "Bump version"
```

### Post-Deployment
- [ ] Check Actions tab for deployment status
- [ ] Verify version updated in production
- [ ] Test functionality on live site

---

## 📊 Monitoring Deployments

### GitHub Actions
- [ ] Bookmark: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
- [ ] Check for green checkmarks ✅
- [ ] Review deployment summaries
- [ ] Check for errors (red X's ❌)

### Firebase Console
- [ ] Visit: https://console.firebase.google.com/
- [ ] Select "mezzters" project
- [ ] Go to Hosting
- [ ] View deployment history
- [ ] Check usage/bandwidth

### Application
- [ ] Version displays in footer
- [ ] Click version shows build time
- [ ] All features working
- [ ] No console errors

---

## 🐛 Troubleshooting Guide

### Deployment Fails

**1. Check GitHub Actions Log**
- [ ] Go to Actions tab
- [ ] Click failed workflow
- [ ] Expand failed step
- [ ] Read error message

**2. Common Issues & Fixes**

| Issue | Solution |
|-------|----------|
| "Secret not found" | Verify secret name matches exactly (case-sensitive) |
| Firebase permission denied | Regenerate service account JSON |
| Build fails | Test `npm run build` locally first |
| Lint errors | Run `npm run lint` and fix issues |
| Environment variable undefined | Check all VITE_* secrets are added |

**3. Nuclear Option (Start Fresh)**
```bash
# Delete node_modules and lockfile
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Try build
npm run build
```

### Version Not Updating

- [ ] Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- [ ] Wait 2-3 minutes for deployment to propagate
- [ ] Check deployment actually succeeded in Actions
- [ ] Verify version bumped in package.json
- [ ] Clear browser cache completely

### Service Account Issues

- [ ] Download fresh service account JSON from Firebase
- [ ] Verify entire JSON is copied (from `{` to `}`)
- [ ] No extra spaces or line breaks
- [ ] Delete and re-add FIREBASE_SERVICE_ACCOUNT secret

---

## 🎯 Version Management

### Version Numbering (Semantic Versioning)

**Format:** `MAJOR.MINOR.PATCH`

**Use:**
- **Patch** (`1.0.0` → `1.0.1`): Bug fixes, small tweaks
  ```bash
  npm run version:bump:patch
  ```

- **Minor** (`1.0.0` → `1.1.0`): New features, no breaking changes
  ```bash
  npm run version:bump:minor
  ```

- **Major** (`1.0.0` → `2.0.0`): Breaking changes
  ```bash
  npm run version:bump:major
  ```

### Version Workflow
```bash
# 1. Bump version
npm run version:bump:minor

# 2. Commit
git add package.json
git commit -m "Release v$(node -p "require('./package.json').version")"

# 3. Tag (optional but recommended)
git tag v$(node -p "require('./package.json').version")

# 4. Push with tags
git push origin main --tags
```

---

## ✅ Success Criteria

Your deployment pipeline is fully working when:

- [✓] Push to `main` triggers automatic deployment
- [✓] GitHub Actions shows green checkmarks
- [✓] Version appears in app footer
- [✓] Build time shows when clicking version
- [✓] Firebase Hosting shows latest deployment
- [✓] PR checks run on pull requests
- [✓] No manual steps required for deployment

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| [GITHUB_SECRETS_VISUAL_GUIDE.md](./GITHUB_SECRETS_VISUAL_GUIDE.md) | Step-by-step secrets setup with visual aids |
| [SETUP_GITHUB_SECRETS.md](./SETUP_GITHUB_SECRETS.md) | Detailed secrets configuration reference |
| [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) | Quick reference for deployments |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment documentation |
| This checklist | Step-by-step setup verification |

---

## 🎉 You're Ready!

Once you complete this checklist:
1. Deployment is fully automated
2. Version tracking is working
3. You can deploy with a simple `git push`
4. Team members can see what version is live
5. Rollbacks are easy through Firebase Console

**Happy Deploying! 🚀**
