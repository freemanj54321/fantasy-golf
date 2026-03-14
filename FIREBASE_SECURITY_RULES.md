# Firebase Security Rules Documentation

## Overview

This document provides recommended Firestore security rules for the Mezzters Invitational application. These rules ensure that only authenticated users can access data, and administrators have special privileges.

## Current Security Concerns

**CRITICAL**: Your Firestore database currently has no validated security rules. Without proper rules, anyone with your Firebase configuration could potentially read or write to your database.

## Recommended Security Rules

### Basic Authentication Rules

These rules ensure only authenticated users can access the application:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             request.auth.token.admin == true;
    }

    function isOwner(ownerEmail) {
      return isAuthenticated() &&
             request.auth.token.email == ownerEmail;
    }

    // PGA Schedule - Read for all authenticated users, write for admins only
    match /PGA-Schedule/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // World Rankings - Read for all authenticated users, write for admins only
    match /World-Rankings/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Tournament Field - Read for all authenticated users, write for admins only
    match /Tournament-Field/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Tournament Players - Read for all authenticated users, write for admins only
    match /Tournament-Players/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Tournament Results - Read for all authenticated users, write for admins only
    match /Tournament-Results/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Mezzter Teams - Read for all authenticated users, write for team owner or admin
    match /Mezzter-Teams/{teamId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isOwner(resource.data.ownerEmail) || isAdmin();
      allow delete: if isAdmin();
    }

    // Default deny all other collections
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## How to Deploy Security Rules

### Method 1: Firebase Console (Recommended for Testing)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **mezzters**
3. Navigate to **Firestore Database** in the left sidebar
4. Click the **Rules** tab at the top
5. Copy and paste the security rules above
6. Click **Publish**

### Method 2: Firebase CLI (Recommended for Production)

1. Create a `firestore.rules` file in your project root:

```bash
# From your project directory
touch firestore.rules
```

2. Copy the security rules above into `firestore.rules`

3. Deploy using Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Testing Security Rules

### Test in Firebase Console

1. Go to **Firestore Database** → **Rules** tab
2. Click the **Rules Playground** button
3. Test various scenarios:
   - Authenticated user reading data
   - Unauthenticated user reading data (should fail)
   - Admin writing data
   - Non-admin writing data (should fail)

### Test in Application

After deploying rules, test these scenarios in your application:

1. **Anonymous Access (Should Fail)**
   - Try accessing the app without logging in
   - Should be redirected to login page

2. **Regular User Access (Should Work)**
   - Log in as a regular user
   - Can view all data (rankings, schedules, teams)
   - Cannot modify admin data (rankings, schedules)
   - Can only modify their own team

3. **Admin Access (Should Work)**
   - Log in as admin (`freemanj54321@gmail.com`)
   - Can view and modify all data

## Advanced Security Rules

### With Field Validation

For more robust security, add field validation:

```javascript
// Mezzter Teams with field validation
match /Mezzter-Teams/{teamId} {
  allow read: if isAuthenticated();

  allow create: if isAuthenticated() &&
                   request.resource.data.keys().hasAll(['name', 'ownerEmail', 'year', 'roster']) &&
                   request.resource.data.ownerEmail == request.auth.token.email &&
                   request.resource.data.roster is list &&
                   request.resource.data.year is int;

  allow update: if (isOwner(resource.data.ownerEmail) || isAdmin()) &&
                   request.resource.data.ownerEmail == resource.data.ownerEmail && // Can't change owner
                   request.resource.data.year == resource.data.year; // Can't change year

  allow delete: if isAdmin();
}
```

### With Rate Limiting

To prevent abuse, you can add rate limiting:

```javascript
function rateLimit(maxRequests) {
  // This is a simple rate limit check
  // In production, consider using Firebase App Check
  return true; // Implement custom rate limiting logic
}
```

## Setting Up Custom Claims (Admin Role)

To set admin custom claims for your account, run this in Firebase Functions or locally:

```javascript
const admin = require('firebase-admin');

async function setAdminRole(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`Admin role set for ${email}`);
}

// Set admin for your account
setAdminRole('freemanj54321@gmail.com');
```

Alternatively, use your existing Firebase Functions:

```bash
# Call your setUserRole function
firebase functions:shell
> setUserRole({ uid: 'your-uid-here', role: 'Administrator' })
```

## Monitoring and Auditing

### Enable Audit Logs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** → **Audit Logs**
4. Enable **Admin Read**, **Data Read**, and **Data Write** logs for Firestore

### Monitor Usage

1. Go to **Firestore Database** in Firebase Console
2. Click the **Usage** tab
3. Monitor for unusual spikes in:
   - Document reads
   - Document writes
   - Document deletes

## Best Practices

1. **Always Test Rules**: Use the Rules Playground before deploying
2. **Start Restrictive**: Begin with deny-all and explicitly allow
3. **Validate Input**: Check field types and required fields
4. **Use Custom Claims**: For role-based access control
5. **Monitor Regularly**: Check usage and audit logs
6. **Version Control**: Keep `firestore.rules` in git
7. **Document Changes**: Comment why specific rules exist

## Common Issues and Solutions

### Issue: "Missing or insufficient permissions"

**Cause**: Security rules are denying access

**Solution**:
1. Check if user is authenticated
2. Verify custom claims are set correctly
3. Review security rules in Firebase Console

### Issue: Rules work in playground but not in app

**Cause**: Rules may not be deployed, or custom claims not refreshed

**Solution**:
1. Ensure rules are published/deployed
2. User may need to sign out and sign in again to refresh token
3. Check that `firebase deploy --only firestore:rules` succeeded

### Issue: "PERMISSION_DENIED: Missing or insufficient permissions"

**Cause**: Trying to access data without proper authentication

**Solution**:
1. Ensure user is logged in before accessing Firestore
2. Check that authentication state is loaded before queries
3. Verify the user's token has required custom claims

## Security Checklist

- [ ] Deploy Firestore security rules
- [ ] Test rules in Rules Playground
- [ ] Set admin custom claims for admin users
- [ ] Test authenticated user access
- [ ] Test unauthenticated access (should fail)
- [ ] Test admin access
- [ ] Test regular user access
- [ ] Enable audit logging
- [ ] Monitor usage for first week
- [ ] Document any custom rules
- [ ] Add `firestore.rules` to version control

## Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Custom Claims Documentation](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Security Rules Testing](https://firebase.google.com/docs/rules/unit-tests)
- [Security Rules Best Practices](https://firebase.google.com/docs/firestore/security/rules-conditions)
