# Deployment Guide

This guide explains how to deploy the Mezzters Invitational application using the automated CI/CD pipeline.

## Overview

The application uses **GitHub Actions** for continuous deployment to **Firebase Hosting**. Every push to the `main` branch automatically triggers a deployment.

## Version Tracking

The application displays the version number in the footer of every page. The version is managed through `package.json` and is automatically embedded during the build process.

### Version Display
- **Location**: Bottom right of every page footer
- **Format**: `v1.0.0`
- **Interaction**: Click to see build timestamp
- **Information shown**:
  - Version number (from package.json)
  - Build timestamp (when the build was created)

### Updating Version Numbers

Use the npm scripts to bump the version:

```bash
# Patch version (1.0.0 -> 1.0.1) - Bug fixes
npm run version:bump:patch

# Minor version (1.0.0 -> 1.1.0) - New features
npm run version:bump:minor

# Major version (1.0.0 -> 2.0.0) - Breaking changes
npm run version:bump:major
```

Or manually edit `package.json`:

```json
{
  "version": "1.0.0"
}
```

## Required GitHub Secrets

Before the deployment pipeline can work, configure these secrets in your GitHub repository:

### Navigation
1. Go to your GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**

### Required Secrets

#### Firebase Configuration
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON (for deployment)
- `FIREBASE_PROJECT_ID`: Your Firebase project ID (e.g., "mezzters")

#### Vite Environment Variables
- `VITE_RAPIDAPI_API_KEY`: Your RapidAPI key
- `VITE_FIREBASE_API_KEY`: Firebase Web API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID

### Getting Firebase Service Account

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Generate service account
# Go to Firebase Console > Project Settings > Service Accounts
# Click "Generate new private key"
# Copy the entire JSON content as the secret value
```

## Deployment Workflows

### 1. Automatic Deployment (deploy.yml)

**Triggers:**
- Push to `main` branch
- Manual trigger via GitHub Actions UI

**Steps:**
1. Checkout code
2. Install Node.js and dependencies
3. Run linter (non-blocking)
4. Build application with version info
5. Deploy to Firebase Hosting
6. Create deployment summary

**View deployments:**
- GitHub Actions tab in your repository
- Firebase Hosting console

### 2. Pull Request Checks (pr-check.yml)

**Triggers:**
- Pull request to `main` branch

**Steps:**
1. Checkout code
2. Install dependencies
3. Run linter (blocking)
4. Build application
5. Comment on PR with build status

## Manual Deployment

If you need to deploy manually:

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

## Deployment Process

### Standard Workflow

1. **Develop** on a feature branch
   ```bash
   git checkout -b feature/my-feature
   # Make changes
   git commit -m "Add new feature"
   git push origin feature/my-feature
   ```

2. **Create Pull Request**
   - PR checks automatically run
   - Review code and ensure checks pass
   - Merge to `main` when ready

3. **Automatic Deployment**
   - Merge triggers deployment workflow
   - Application builds with current version
   - Deploys to Firebase Hosting
   - Version displays in UI footer

### Version Release Workflow

1. **Update version number**
   ```bash
   npm run version:bump:minor  # or patch/major
   git add package.json
   git commit -m "Bump version to v1.1.0"
   ```

2. **Create Git tag** (optional but recommended)
   ```bash
   git tag v1.1.0
   git push origin main --tags
   ```

3. **Push to trigger deployment**
   ```bash
   git push origin main
   ```

4. **Verify deployment**
   - Check GitHub Actions for successful deployment
   - Visit the site and verify version in footer
   - Check Firebase Hosting console

## Build Configuration

### Vite Build Process

The build injects version information through `vite.config.ts`:

```typescript
define: {
  '__APP_VERSION__': JSON.stringify(version),
  '__BUILD_TIME__': JSON.stringify(buildTime),
}
```

### Environment Variables

Environment variables are injected during build:
- Prefix with `VITE_` to expose to client code
- Set in GitHub Secrets for CI/CD
- Set in `.env.local` for local development (not committed)

### Build Output

- **Directory**: `dist/`
- **Format**: Static HTML, CSS, JS
- **Hosting**: Firebase Hosting serves from `dist/`

## Troubleshooting

### Deployment fails

1. **Check GitHub Actions logs**
   - Go to Actions tab
   - Click on failed workflow
   - Review error messages

2. **Common issues**
   - Missing secrets → Add required secrets
   - Build errors → Fix locally first, test with `npm run build`
   - Firebase permissions → Check service account permissions
   - Lint errors → Fix with `npm run lint`

### Version not updating

1. **Ensure version changed in package.json**
2. **Clear browser cache** (Ctrl+F5 or Cmd+Shift+R)
3. **Check build logs** to verify version was embedded
4. **Wait for deployment** to complete

### Local development issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

## Monitoring

### Deployment Status

- **GitHub Actions**: Real-time deployment progress
- **Firebase Console**: Hosting deployment history
- **Application**: Version number in footer

### Rollback

If you need to rollback to a previous version:

1. **Via Firebase Console**
   - Go to Hosting
   - View deployment history
   - Click "Rollback" on previous deployment

2. **Via Git**
   ```bash
   git revert <commit-hash>
   git push origin main
   # New deployment with reverted changes
   ```

## Best Practices

1. **Always bump version** before merging to main
2. **Use semantic versioning** (major.minor.patch)
3. **Test locally** before pushing (`npm run build`)
4. **Review PR checks** before merging
5. **Monitor deployments** in GitHub Actions
6. **Tag releases** for easy rollback
7. **Keep secrets updated** in GitHub repository settings

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

The version component works locally but shows the version at build time, not development runtime.

## Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
- [Semantic Versioning](https://semver.org/)
