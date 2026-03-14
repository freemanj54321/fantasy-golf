# Troubleshooting "Missing or insufficient permissions" Error

## The Issue

You're seeing this error on the Masters page:
```
FirebaseError: Missing or insufficient permissions
```

This means the Firestore security rules **are working correctly** but something is preventing access.

## Quick Fix (Most Common)

### **Solution: Sign Out and Sign Back In**

The security rules were just deployed, and your authentication token needs to be refreshed.

**Steps:**
1. **Sign out** of the application
2. **Close all browser tabs** with your app open
3. **Clear browser cache** (optional but recommended):
   - Press `Ctrl+Shift+Delete`
   - Select "Cached images and files"
   - Click "Clear data"
4. **Sign back in** to the application
5. **Try accessing the Masters page again**

This refreshes your authentication token with the new security rules.

---

## Diagnostic Steps

### Step 1: Check if You're Logged In

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run this command:
   ```javascript
   firebase.auth().currentUser
   ```

**Expected:**
- If logged in: Shows your user object with email
- If NOT logged in: Shows `null` ← **This is the problem**

### Step 2: Check Authentication State

Run this in console:
```javascript
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('Logged in as:', user.email);
  } else {
    console.log('Not logged in');
  }
});
```

### Step 3: Verify Security Rules Are Active

1. Go to [Firebase Console](https://console.firebase.google.com/project/mezzters/firestore/rules)
2. Check the "Rules" tab
3. Should show your deployed rules with `isAuthenticated()` function
4. Check the timestamp - should be recent (today)

### Step 4: Test Access Manually

In browser console:
```javascript
// Import Firestore functions
const { collection, query, where, getDocs } = await import('firebase/firestore');
const { db } = await import('./firebase.js');

// Try to access Tournament-Results
const q = query(
  collection(db, 'Tournament-Results'),
  where('year', '==', 2025),
  where('tournId', '==', '014')
);

try {
  const snapshot = await getDocs(q);
  console.log('✓ Access granted! Found', snapshot.size, 'documents');
} catch (error) {
  console.error('✗ Access denied:', error.code, error.message);
}
```

---

## Common Causes and Solutions

### Cause 1: Not Logged In ❌

**Symptoms:**
- Redirected to login page
- No user info in header
- Console shows `currentUser = null`

**Solution:**
- Log in to the application
- Make sure you're on the correct account

### Cause 2: Old Authentication Token ⚠️

**Symptoms:**
- Was working before rules deployment
- Stopped working after rules deployment
- User is logged in but still getting errors

**Solution:**
- Sign out completely
- Close all tabs
- Clear browser cache
- Sign back in
- This refreshes your token

### Cause 3: Rules Not Deployed ❌

**Symptoms:**
- Firebase Console shows old rules
- Timestamp on rules is old

**Solution:**
```bash
firebase deploy --only firestore:rules
```

### Cause 4: Indexes Still Building ⚠️

**Symptoms:**
- Getting "index required" errors along with permissions errors
- Firebase Console shows indexes as "Building"

**Solution:**
- Wait 5-10 minutes for indexes to finish building
- Check Firebase Console → Indexes tab
- Status should change to "Enabled"

---

## The Security Rules Explained

Your current rules require authentication for `Tournament-Results`:

```javascript
match /Tournament-Results/{document} {
  allow read: if isAuthenticated();  // ← Must be logged in
  allow write: if isAdmin();         // ← Must be admin
}

function isAuthenticated() {
  return request.auth != null;       // ← Checks if user is logged in
}
```

**This is working as intended!** The error means:
- ✅ Security rules are active
- ✅ Rules are protecting your data
- ❌ Your current token doesn't have authentication

---

## Expected Behavior After Fix

Once you sign out and back in, you should see:

### In Console:
```
[Firebase] Offline persistence enabled
Auth state changed: user@example.com
Tournament-Results: 45 documents loaded
```

### On Masters Page:
- ✅ Leaderboard loads successfully
- ✅ Player names and scores display
- ✅ No permission errors

---

## Advanced: Force Token Refresh

If signing out/in doesn't work, force a token refresh:

```javascript
// In browser console
const user = firebase.auth().currentUser;
if (user) {
  user.getIdToken(true).then((token) => {
    console.log('Token refreshed!');
    // Reload the page
    window.location.reload();
  });
}
```

---

## Verification Checklist

After applying the fix:

- [ ] Signed out of application
- [ ] Closed all browser tabs
- [ ] Cleared browser cache
- [ ] Signed back in
- [ ] Masters page loads without errors
- [ ] Browser console shows no permission errors
- [ ] Can see tournament results

---

## Still Having Issues?

If the problem persists after trying all solutions:

1. **Check browser console** for detailed error messages
2. **Run the test suite:**
   ```javascript
   testFirebaseConnection()
   ```
3. **Verify in Firebase Console:**
   - Rules are deployed (check timestamp)
   - Indexes are "Enabled" (not "Building")
4. **Try a different browser** or incognito mode
5. **Check Firebase service status**: https://status.firebase.google.com/

---

## Prevention

To avoid this in the future:

1. **Deploy rules during maintenance windows**
2. **Warn users** to refresh after rule changes
3. **Add error boundary** to catch and display permission errors gracefully
4. **Test in emulator** before deploying to production

---

**TL;DR: Sign out, clear cache, sign back in. This refreshes your authentication token with the new security rules.**
