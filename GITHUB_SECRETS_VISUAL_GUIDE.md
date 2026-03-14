# GitHub Secrets - Visual Step-by-Step Guide

This is a simplified visual guide for setting up GitHub Secrets. Follow along step-by-step with screenshots.

## 🎯 Goal
Add 9 secrets to GitHub so your app can automatically deploy to Firebase.

---

## Part 1: Navigate to Secrets (5 steps)

### Step 1: Go to Your Repository
Visit: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`

### Step 2: Click "Settings"
Look for the Settings tab at the top of your repository page.

```
Code    Issues    Pull requests    Actions    [Settings] ← Click here
```

### Step 3: Find "Secrets and variables" in Sidebar
On the left sidebar, scroll down to the "Security" section:

```
Security
  ├── Code security and analysis
  ├── Deploy keys
  ├── [Secrets and variables] ← Click here
  └── Actions
```

### Step 4: Click "Actions"
You'll see options like:
- Actions
- Codespaces
- Dependabot

Click **Actions**

### Step 5: You're Ready!
You should now see a page titled:
**"Actions secrets and variables"**

There's a green button that says **"New repository secret"**

---

## Part 2: Add the First Secret (Example)

Let me show you how to add ONE secret. Then you'll repeat this 8 more times.

### Example: Adding FIREBASE_PROJECT_ID

1. **Click** the green **"New repository secret"** button

2. **Fill in the form:**
   ```
   Name: FIREBASE_PROJECT_ID

   Secret: mezzters
   ```

3. **Click** the green **"Add secret"** button at the bottom

4. **Success!** You'll see it in the list (but the value will be hidden as `***`)

---

## Part 3: Add All 9 Secrets

Now repeat the process above for each secret below. Click "New repository secret" each time.

### Secret 1 ✅
```
Name: FIREBASE_PROJECT_ID
Value: mezzters
```

### Secret 2 ⚠️ (Needs Firebase Console)
```
Name: FIREBASE_SERVICE_ACCOUNT
Value: [See "Getting Service Account JSON" section below]
```

### Secret 3
```
Name: VITE_FIREBASE_API_KEY
Value: AIzaSyDml6waEHdDZiRhlO8T5SwgCAtHIP7viwA
```

### Secret 4
```
Name: VITE_FIREBASE_AUTH_DOMAIN
Value: mezzters.firebaseapp.com
```

### Secret 5
```
Name: VITE_FIREBASE_PROJECT_ID
Value: mezzters
```

### Secret 6
```
Name: VITE_FIREBASE_STORAGE_BUCKET
Value: mezzters.firebasestorage.app
```

### Secret 7
```
Name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 724741628120
```

### Secret 8
```
Name: VITE_FIREBASE_APP_ID
Value: 1:724741628120:web:ff86dcd83e2e03d2ce37ad
```

### Secret 9
```
Name: VITE_RAPIDAPI_API_KEY
Value: 1a508ac895msh6d7093458613273p1d1d79jsnd79b1d9c3db3
```

---

## 🔥 Getting Service Account JSON (Secret 2)

This is the only tricky one. Follow these steps:

### Step 1: Open Firebase Console
Go to: https://console.firebase.google.com/

### Step 2: Select Your Project
Click on **"mezzters"**

### Step 3: Go to Project Settings
Look for the gear icon ⚙️ next to "Project Overview" (top left)
Click it, then click **"Project settings"**

### Step 4: Go to Service Accounts Tab
You'll see tabs at the top:
```
General    Service accounts    Cloud Messaging    etc.
```
Click **"Service accounts"**

### Step 5: Generate Key
You'll see a section that says "Firebase Admin SDK"

1. Look for the button: **"Generate new private key"**
2. Click it
3. A dialog appears warning you about security
4. Click **"Generate key"**
5. A `.json` file downloads to your computer

### Step 6: Copy the JSON
1. Open the downloaded `.json` file with a text editor (Notepad, VS Code, etc.)
2. Select **ALL** the text (Ctrl+A / Cmd+A)
3. Copy it (Ctrl+C / Cmd+C)

### Step 7: Add to GitHub
1. Go back to GitHub Secrets page
2. Click "New repository secret"
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Paste the entire JSON content as the value
5. Click "Add secret"

**Example of what the JSON looks like:**
```json
{
  "type": "service_account",
  "project_id": "mezzters",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxxxx@mezzters.iam.gserviceaccount.com",
  ...
}
```

Copy the **entire thing** including the curly braces!

---

## ✅ Verification

After adding all secrets, your secrets list should show:

1. FIREBASE_PROJECT_ID
2. FIREBASE_SERVICE_ACCOUNT
3. VITE_FIREBASE_API_KEY
4. VITE_FIREBASE_AUTH_DOMAIN
5. VITE_FIREBASE_PROJECT_ID
6. VITE_FIREBASE_STORAGE_BUCKET
7. VITE_FIREBASE_MESSAGING_SENDER_ID
8. VITE_FIREBASE_APP_ID
9. VITE_RAPIDAPI_API_KEY

**Total: 9 secrets**

The values will show as `***` (that's normal - GitHub hides them for security)

---

## 🧪 Test It Works

### Option 1: Push to Main
```bash
git add .
git commit -m "Configure deployment"
git push origin main
```

Then:
1. Go to your repo
2. Click **"Actions"** tab (top navigation)
3. You should see "Deploy to Firebase Hosting" running
4. Wait for it to complete (green checkmark ✅)

### Option 2: Manual Trigger
1. Go to **Actions** tab
2. Click **"Deploy to Firebase Hosting"** in the left sidebar
3. Click **"Run workflow"** dropdown (right side)
4. Click green **"Run workflow"** button
5. Watch it run!

---

## ❌ Common Mistakes

### Mistake 1: Wrong Secret Name
❌ `firebase_project_id` (lowercase)
✅ `FIREBASE_PROJECT_ID` (exactly as shown)

### Mistake 2: Extra Spaces
❌ Name: ` VITE_FIREBASE_API_KEY ` (spaces before/after)
✅ Name: `VITE_FIREBASE_API_KEY` (no extra spaces)

### Mistake 3: Partial JSON
❌ Copying only part of the service account JSON
✅ Copy from the first `{` to the last `}`

### Mistake 4: Adding Quotes
❌ Value: `"mezzters"` (with quotes)
✅ Value: `mezzters` (no quotes)

---

## 🎉 You're Done!

Once all 9 secrets are added:
- Push any commit to `main` → Auto-deploy! 🚀
- Check the **Actions** tab to watch deployments
- Version number appears in your app footer

---

## 🆘 Need Help?

If something goes wrong:
1. Check the Actions tab for error messages
2. Verify all 9 secrets exist
3. Make sure names match exactly
4. Try deleting and re-adding a secret
5. Check that your Firebase project has Hosting enabled

---

## 📚 More Info

- Full documentation: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Detailed secrets guide: [SETUP_GITHUB_SECRETS.md](./SETUP_GITHUB_SECRETS.md)
- Quick deploy reference: [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)
