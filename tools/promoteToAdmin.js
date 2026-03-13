/*
 * promoteToAdmin.js
 *
 * Quick script to promote a user to admin role.
 * Run this while the backend server is running.
 *
 * Usage:
 *   node promoteToAdmin.js <email>
 *
 * Dependencies: @google-cloud/firestore
 */

const { Firestore } = require('@google-cloud/firestore');
const path = require('path');

// Configuration
const keyPath = path.join(__dirname, '../backend/RideHub.Api/firebase-key.json');
const firestore = new Firestore({ keyFilename: keyPath });

async function promoteToAdmin(email) {
  try {
    console.log(`Promoting ${email} to admin...`);

    // Find user by email
    const userSnapshot = await firestore.collection('users').where('Email', '==', email).get();

    if (userSnapshot.empty) {
      console.error(`User with email ${email} not found`);
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    console.log(`Found user: ${userData.FullName} (${userData.Uid})`);

    // Update role to Admin
    await firestore.collection('users').doc(userDoc.id).update({
      Role: 'Admin'
    });

    console.log(`Successfully promoted ${email} to Admin role`);

    // Note: Firebase custom claims would need to be updated via Firebase Admin SDK
    // For now, the Firestore role is updated, but you may need to re-login for claims to update

  } catch (error) {
    console.error('Error promoting user:', error);
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: node promoteToAdmin.js <email>');
  process.exit(1);
}

promoteToAdmin(email);