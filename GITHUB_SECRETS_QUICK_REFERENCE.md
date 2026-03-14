# GitHub Secrets - Quick Copy/Paste Reference

## 🎯 Where to Add Secrets

**GitHub URL:** `Settings > Secrets and variables > Actions > New repository secret`

---

## 📋 Copy/Paste Each Secret

### Secret 1/9
**Name:**
```
FIREBASE_PROJECT_ID
```
**Value:**
```
mezzters
```

---

### Secret 2/9 ⚠️ SPECIAL
**Name:**
```
FIREBASE_SERVICE_ACCOUNT
```
**Value:**
```
[Get from Firebase Console - See instructions below]
```

**How to get this value:**
1. Go to https://console.firebase.google.com/
2. Select "mezzters" project
3. Click ⚙️ > Project settings > Service accounts tab
4. Click "Generate new private key"
5. Click "Generate key" (downloads JSON file)
6. Open the JSON file
7. Copy ENTIRE contents (from `{` to `}`)
8. Paste as the secret value

---

### Secret 3/9
**Name:**
```
VITE_FIREBASE_API_KEY
```
**Value:**
```
AIzaSyDml6waEHdDZiRhlO8T5SwgCAtHIP7viwA
```

---

### Secret 4/9
**Name:**
```
VITE_FIREBASE_AUTH_DOMAIN
```
**Value:**
```
mezzters.firebaseapp.com
```

---

### Secret 5/9
**Name:**
```
VITE_FIREBASE_PROJECT_ID
```
**Value:**
```
mezzters
```

---

### Secret 6/9
**Name:**
```
VITE_FIREBASE_STORAGE_BUCKET
```
**Value:**
```
mezzters.firebasestorage.app
```

---

### Secret 7/9
**Name:**
```
VITE_FIREBASE_MESSAGING_SENDER_ID
```
**Value:**
```
724741628120
```

---

### Secret 8/9
**Name:**
```
VITE_FIREBASE_APP_ID
```
**Value:**
```
1:724741628120:web:ff86dcd83e2e03d2ce37ad
```

---

### Secret 9/9
**Name:**
```
VITE_RAPIDAPI_API_KEY
```
**Value:**
```
1a508ac895msh6d7093458613273p1d1d79jsnd79b1d9c3db3
```

---

## ✅ Verification

After adding all secrets, you should have **9 total secrets**:

1. ✓ FIREBASE_PROJECT_ID
2. ✓ FIREBASE_SERVICE_ACCOUNT
3. ✓ VITE_FIREBASE_API_KEY
4. ✓ VITE_FIREBASE_AUTH_DOMAIN
5. ✓ VITE_FIREBASE_PROJECT_ID
6. ✓ VITE_FIREBASE_STORAGE_BUCKET
7. ✓ VITE_FIREBASE_MESSAGING_SENDER_ID
8. ✓ VITE_FIREBASE_APP_ID
9. ✓ VITE_RAPIDAPI_API_KEY

---

## 🧪 Test

Push to main branch to trigger deployment:
```bash
git push origin main
```

Then check:
- GitHub Actions tab → see workflow running
- Wait for ✅ green checkmark
- Visit your site
- See version in footer

---

## 🆘 Having Issues?

See detailed guides:
- [Visual Guide](./GITHUB_SECRETS_VISUAL_GUIDE.md) - Step-by-step with screenshots
- [Checklist](./DEPLOYMENT_CHECKLIST.md) - Complete setup checklist
