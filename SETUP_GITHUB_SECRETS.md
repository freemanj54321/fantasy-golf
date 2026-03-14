# GitHub Secrets Setup Guide

This guide will walk you through setting up GitHub Secrets for automatic deployment.

## 📍 Step-by-Step Instructions

### Step 1: Navigate to GitHub Secrets

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/mezztersv2`
2. Click on **Settings** (top navigation bar)
3. In the left sidebar, click **Secrets and variables**
4. Click **Actions**
5. You'll see a page titled "Actions secrets and variables"

### Step 2: Add Each Secret

For each secret below, follow these steps:
1. Click the **"New repository secret"** button (green button, top right)
2. Enter the **Name** exactly as shown (case-sensitive!)
3. Copy and paste the **Value**
4. Click **"Add secret"**

---

## 🔐 Secrets to Add

### Firebase Deployment Secrets

#### 1. FIREBASE_PROJECT_ID
- **Name:** `FIREBASE_PROJECT_ID`
- **Value:** `mezzters`
- **Description:** Your Firebase project ID

#### 2. FIREBASE_SERVICE_ACCOUNT
- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** You need to generate this (instructions below)
- **Description:** Firebase service account credentials for deployment

**How to get FIREBASE_SERVICE_ACCOUNT:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **mezzters**
3. Click the gear icon ⚙️ next to "Project Overview"
4. Click **Project settings**
5. Go to the **Service accounts** tab
6. Click **Generate new private key**
7. Click **Generate key** to download the JSON file
8. Open the downloaded JSON file
9. Copy the **entire contents** of the file
10. Paste it as the secret value in GitHub

---

### Firebase Configuration Secrets

#### 3. VITE_FIREBASE_API_KEY
- **Name:** `VITE_FIREBASE_API_KEY`
- **Value:** `AIzaSyDml6waEHdDZiRhlO8T5SwgCAtHIP7viwA`

#### 4. VITE_FIREBASE_AUTH_DOMAIN
- **Name:** `VITE_FIREBASE_AUTH_DOMAIN`
- **Value:** `mezzters.firebaseapp.com`

#### 5. VITE_FIREBASE_PROJECT_ID
- **Name:** `VITE_FIREBASE_PROJECT_ID`
- **Value:** `mezzters`

#### 6. VITE_FIREBASE_STORAGE_BUCKET
- **Name:** `VITE_FIREBASE_STORAGE_BUCKET`
- **Value:** `mezzters.firebasestorage.app`

#### 7. VITE_FIREBASE_MESSAGING_SENDER_ID
- **Name:** `VITE_FIREBASE_MESSAGING_SENDER_ID`
- **Value:** `724741628120`

#### 8. VITE_FIREBASE_APP_ID
- **Name:** `VITE_FIREBASE_APP_ID`
- **Value:** `1:724741628120:web:ff86dcd83e2e03d2ce37ad`

---

### RapidAPI Configuration Secrets

#### 9. VITE_RAPIDAPI_API_KEY
- **Name:** `VITE_RAPIDAPI_API_KEY`
- **Value:** `1a508ac895msh6d7093458613273p1d1d79jsnd79b1d9c3db3`

---

## ✅ Verification Checklist

After adding all secrets, you should have **9 secrets total**:

- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_SERVICE_ACCOUNT
- [ ] VITE_FIREBASE_API_KEY
- [ ] VITE_FIREBASE_AUTH_DOMAIN
- [ ] VITE_FIREBASE_PROJECT_ID
- [ ] VITE_FIREBASE_STORAGE_BUCKET
- [ ] VITE_FIREBASE_MESSAGING_SENDER_ID
- [ ] VITE_FIREBASE_APP_ID
- [ ] VITE_RAPIDAPI_API_KEY

## 🧪 Test the Setup

Once all secrets are added:

1. **Push a commit to main branch:**
   ```bash
   git add .
   git commit -m "Test deployment pipeline"
   git push origin main
   ```

2. **Watch the deployment:**
   - Go to the **Actions** tab in your GitHub repository
   - You should see a workflow running called "Deploy to Firebase Hosting"
   - Click on it to see the deployment progress

3. **Verify success:**
   - The workflow should complete with green checkmarks ✅
   - Visit your Firebase Hosting URL
   - Check the version number in the footer

## 🆘 Troubleshooting

### "Secret not found" errors
- Make sure the secret name is **exactly** as shown (case-sensitive)
- No extra spaces before or after the name
- No extra spaces in the value

### Firebase deployment fails
- Double-check FIREBASE_SERVICE_ACCOUNT is the complete JSON
- Ensure the service account has "Firebase Hosting Admin" permissions
- Verify FIREBASE_PROJECT_ID matches your project exactly

### Build fails with environment variable errors
- Verify all VITE_* secrets are added
- Check for typos in secret names
- Ensure values don't have extra quotes or spaces

### Still having issues?
- Check the Actions tab for detailed error logs
- Verify your Firebase project is set up for hosting
- Ensure you have billing enabled on Firebase (required for GitHub Actions)

## 📝 Notes

- **Secrets are encrypted** - GitHub hides them in logs with `***`
- **You can update secrets** anytime by clicking on them in the secrets list
- **Secrets are not exposed** to pull requests from forks (security feature)
- **Only repository admins** can view/edit secrets

## 🔄 Updating Secrets

If you need to change a secret later:

1. Go to Settings > Secrets and variables > Actions
2. Click on the secret name
3. Click **Update secret**
4. Enter the new value
5. Click **Update secret**

The next deployment will use the new value automatically.

## 🎯 What Happens Next?

Once secrets are configured:
1. Every push to `main` triggers automatic deployment
2. The app builds with your environment variables
3. Version from package.json is embedded
4. App deploys to Firebase Hosting
5. Users see the new version in the footer

---

## Quick Copy-Paste Reference

For quick setup, here are all the names (copy one at a time):

```
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_RAPIDAPI_API_KEY
```

And here are the corresponding values for your project (DO NOT share these publicly):

```
mezzters
[GENERATE FROM FIREBASE CONSOLE - see instructions above]
AIzaSyDml6waEHdDZiRhlO8T5SwgCAtHIP7viwA
mezzters.firebaseapp.com
mezzters
mezzters.firebasestorage.app
724741628120
1:724741628120:web:ff86dcd83e2e03d2ce37ad
1a508ac895msh6d7093458613273p1d1d79jsnd79b1d9c3db3
```

**⚠️ IMPORTANT:** The FIREBASE_SERVICE_ACCOUNT must be generated from Firebase Console. See instructions above.
