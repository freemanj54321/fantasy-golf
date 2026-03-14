# Quick Deployment Reference

## 🚀 Deploy to Production

```bash
# 1. Bump version (choose one)
npm run version:bump:patch   # Bug fixes (1.0.0 -> 1.0.1)
npm run version:bump:minor   # New features (1.0.0 -> 1.1.0)
npm run version:bump:major   # Breaking changes (1.0.0 -> 2.0.0)

# 2. Commit version bump
git add package.json
git commit -m "Bump version to v$(node -p "require('./package.json').version")"

# 3. Push to main (triggers auto-deploy)
git push origin main

# 4. Optional: Create git tag
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

## 📋 First Time Setup

### 1. GitHub Secrets (Settings > Secrets and variables > Actions)

```
FIREBASE_SERVICE_ACCOUNT=<firebase-service-account-json>
FIREBASE_PROJECT_ID=mezzters

VITE_RAPIDAPI_API_KEY=<your-key>
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
VITE_FIREBASE_PROJECT_ID=<your-id>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-id>
VITE_FIREBASE_APP_ID=<your-id>
```

### 2. Local Development Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# (never commit this file!)

# Install dependencies
npm install

# Run development server
npm run dev
```

## ✅ Pre-Deploy Checklist

- [ ] Version bumped in package.json
- [ ] Code builds locally (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Changes committed and pushed
- [ ] GitHub Actions workflow exists
- [ ] GitHub Secrets configured

## 🔍 Verify Deployment

1. **Check GitHub Actions**: Go to Actions tab, verify workflow succeeded
2. **Check Version**: Visit site, click version in footer (bottom right)
3. **Check Firebase**: Go to Firebase Console > Hosting

## 🆘 Troubleshooting

**Build fails?**
```bash
npm run build  # Test locally first
```

**Secrets missing?**
- Go to GitHub Settings > Secrets
- Verify all required secrets exist

**Rollback needed?**
- Firebase Console > Hosting > View deployment history > Rollback

**Version not showing?**
- Hard refresh browser (Ctrl+F5 / Cmd+Shift+R)
- Wait for deployment to complete

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete documentation.
