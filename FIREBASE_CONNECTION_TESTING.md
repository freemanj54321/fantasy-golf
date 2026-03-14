# Firebase Connection Testing Guide

## Overview

This guide provides multiple methods to test your Firebase database connection and verify that all improvements are working correctly.

## Testing Methods

### Method 1: Automated Test Suite (Browser Console)

The automated test suite runs comprehensive checks on your Firebase configuration.

#### How to Use:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the application in your browser:**
   - Navigate to `http://localhost:5173`
   - Log in to the application

3. **Open Browser DevTools:**
   - Press `F12` or right-click → "Inspect"
   - Go to the "Console" tab

4. **Run the test suite:**
   ```javascript
   testFirebaseConnection()
   ```

5. **Review the results:**
   - Green ✓ = Test passed
   - Yellow ⚠ = Warning (needs attention)
   - Red ✗ = Test failed (critical issue)

#### What It Tests:

- ✓ Environment variables configuration
- ✓ Firebase initialization (Firestore, Auth, Storage)
- ✓ Network connection status
- ✓ Firestore read access for all collections
- ✓ Security rules enforcement
- ✓ Admin role detection
- ✓ Offline persistence functionality

### Method 2: Visual Test Component (Admin Page)

A visual testing component is available for admin users.

#### How to Use:

1. **Add the component to AdminPage:**

   Open `src/pages/AdminPage.tsx` and add:

   ```typescript
   import FirebaseConnectionTest from '../components/FirebaseConnectionTest';

   // Inside the return statement, add:
   <FirebaseConnectionTest />
   ```

2. **Access the admin page:**
   - Navigate to `/admin` route
   - Click "Run Tests" button
   - View results with expandable details

#### Benefits:

- Visual feedback with color-coded results
- Detailed error messages
- Actionable recommendations
- No console required

### Method 3: Manual Console Checks

Check for Firebase logs in the browser console during normal application use.

#### Expected Logs:

**On Successful Connection:**
```
[Firebase] Offline persistence enabled
[Firebase] Connection restored
```

**On Firestore Operations:**
```
[FirebaseService] Saving tour schedule for year 2025 with 50 events
[FirebaseService] Fetching existing documents in 5 chunk(s)
[FirebaseService] Found 45 existing documents
[FirebaseService] Committing 1 batch(es) with 5 creates and 45 updates
[FirebaseService] All batches committed successfully
```

**On Team Operations:**
```
[TeamService] Fetching teams for year 2025
[TeamService] Fetched 8 teams
```

#### Warning Signs:

❌ **Permission Denied Errors:**
```
FirebaseError: Missing or insufficient permissions
```
→ **Solution:** Deploy security rules

❌ **Missing Index Errors:**
```
The query requires an index. You can create it here: https://...
```
→ **Solution:** Deploy indexes with `firebase deploy --only firestore:indexes`

❌ **Connection Errors:**
```
[Firebase] Connection lost
```
→ **Solution:** Check internet connection or Firebase service status

### Method 4: Firebase Emulator Testing

Test locally with Firebase emulators before deploying to production.

#### Setup:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Start emulators:**
   ```bash
   firebase emulators:start --only firestore
   ```

3. **Update firebase config temporarily:**

   In `src/firebase.ts`, add:
   ```typescript
   import { connectFirestoreEmulator } from 'firebase/firestore';

   // After initializing Firestore
   if (process.env.NODE_ENV === 'development') {
     connectFirestoreEmulator(db, 'localhost', 8080);
   }
   ```

4. **Run your app:**
   ```bash
   npm run dev
   ```

#### Benefits:

- Test security rules without affecting production
- No risk to production data
- Faster iteration on rule changes
- Local development without internet

### Method 5: Production Verification

After deploying to production, verify everything works correctly.

#### Checklist:

- [ ] **Deploy rules and indexes:**
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```

- [ ] **Test anonymous access:**
  - Open app in incognito window
  - Should redirect to login page
  - No data should be accessible

- [ ] **Test authenticated access:**
  - Log in as regular user
  - Should see all data
  - Cannot access admin functions

- [ ] **Test admin access:**
  - Log in as admin (`freemanj54321@gmail.com`)
  - Can sync data
  - Can modify all collections

- [ ] **Monitor Firebase Console:**
  - Go to [Firebase Console](https://console.firebase.google.com/)
  - Select "mezzters" project
  - Check **Firestore Database** → **Usage** tab
  - Look for unusual spikes or errors

## Common Issues and Solutions

### Issue 1: "Permission Denied" Errors

**Symptoms:**
- Cannot read data after logging in
- "Missing or insufficient permissions" in console

**Solutions:**

1. **Check if rules are deployed:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Verify rules in Firebase Console:**
   - Go to Firestore → Rules tab
   - Should show the updated rules from `firestore.rules`

3. **Check authentication:**
   - User must be logged in
   - Token may need refresh (sign out and back in)

4. **Verify collection names:**
   - Check that app uses correct collection names from `COLLECTIONS` constant

### Issue 2: "Missing Index" Errors

**Symptoms:**
- Query fails with index creation link
- Slow queries

**Solutions:**

1. **Deploy indexes:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Or click the link in the error:**
   - Opens Firebase Console to create index
   - Wait for index to build (can take minutes)

3. **Check index status:**
   - Firebase Console → Firestore → Indexes
   - Should show all 12 indexes as "Enabled"

### Issue 3: Connection Failures

**Symptoms:**
- "Firebase Connection lost" warnings
- Data not syncing

**Solutions:**

1. **Check internet connection:**
   - Verify device is online
   - Check firewall settings

2. **Verify Firebase configuration:**
   - Run `testFirebaseConnection()` in console
   - Check environment variables

3. **Check offline persistence:**
   - Close all tabs except one
   - "Multiple tabs" error means persistence is limited

### Issue 4: Environment Variables Not Working

**Symptoms:**
- Using fallback values
- Configuration warnings in tests

**Solutions:**

1. **For local development:**
   - Create `.env.local` file
   - Copy values from `.env.example`
   - Fill in actual Firebase credentials

2. **For GitHub Actions:**
   - Add all secrets to repository
   - See [SETUP_GITHUB_SECRETS.md](./SETUP_GITHUB_SECRETS.md)
   - Include `VITE_FIREBASE_MEASUREMENT_ID`

3. **Restart dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

## Performance Testing

### Before Improvements:

Test sync performance before the improvements were applied:

```javascript
// In browser console
console.time('sync-rankings');
// Run sync operation
console.timeEnd('sync-rankings');
// Expected: 5-10 seconds for 100 players
```

### After Improvements:

Test sync performance after improvements:

```javascript
console.time('sync-rankings');
// Run sync operation
console.timeEnd('sync-rankings');
// Expected: 1-2 seconds for 100 players (80% faster)
```

### Query Count Comparison:

**Before:**
- 100 players = 100 individual queries + 1 batch write

**After:**
- 100 players = 10 chunked queries (in parallel) + 1 batch write

**Monitor in console:**
```javascript
// Look for these logs:
[FirebaseService] Fetching existing documents in 10 chunk(s)
[FirebaseService] Found 95 existing documents
```

## Security Testing

### Test Authentication Rules:

1. **Test unauthenticated access:**
   ```javascript
   // Log out
   await firebase.auth().signOut();

   // Try to fetch data (should fail)
   const q = query(collection(db, 'PGA-Schedule'), limit(1));
   await getDocs(q); // Should throw permission-denied error
   ```

2. **Test authenticated access:**
   ```javascript
   // Log in
   // Try to fetch data (should work)
   const q = query(collection(db, 'PGA-Schedule'), limit(1));
   await getDocs(q); // Should succeed
   ```

3. **Test admin write access:**
   ```javascript
   // As admin, try to write to PGA-Schedule (should work)
   // As regular user, try to write to PGA-Schedule (should fail)
   ```

## Next Steps

After testing:

1. ✅ **Verify all tests pass**
2. ✅ **Deploy rules and indexes to production**
3. ✅ **Monitor Firebase Console for first week**
4. ✅ **Check application logs for errors**
5. ✅ **Test all major workflows**
6. ✅ **Document any issues found**

## Additional Resources

- [Firebase Connection Test Script](./test-firebase-connection.js)
- [Firebase Security Rules](./FIREBASE_SECURITY_RULES.md)
- [Firebase Improvements Summary](./FIREBASE_IMPROVEMENTS_SUMMARY.md)
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Emulator Documentation](https://firebase.google.com/docs/emulator-suite)

## Support

If tests are failing:

1. Review error messages in console
2. Check Firebase Console for rule/index status
3. Verify environment variables are set
4. Ensure rules and indexes are deployed
5. Try clearing browser cache and signing out/in
6. Check [FIREBASE_IMPROVEMENTS_SUMMARY.md](./FIREBASE_IMPROVEMENTS_SUMMARY.md) for troubleshooting

---

**Status**: Ready for testing
**Last Updated**: 2026-01-17
