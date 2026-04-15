/*
 * seedBookings.js
 *
 * Quick and dirty Node script to populate the local API with several
 * tourist accounts and associated bookings.  Run this while the backend
 * server is running on http://localhost:5202.
 *
 * Usage:
 *   node tools/seedBookings.js
 *
 * Dependencies: none beyond the builtin `fetch` (Node 18+) and `crypto`.
 * You can install faker if you want more realistic names, but the script
 * includes a tiny helper instead.
 *
 * Note: The script registers each user, immediately signs in using the
 * Firebase REST API to obtain an ID token, then calls the booking POST
 * endpoint to create a booking.  All generated tourists use the same
 * password (`Password123!`).
 */

// configuration (allows env override for flexibility)
const API_BASE = process.env.API_BASE || 'http://localhost:5202/api';
// IMPORTANT: Set FIREBASE_API_KEY environment variable before running this script
// Get your Firebase API key from Firebase Console > Project Settings > Web API Key
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY_HERE';

// if you want the script to patch bookings directly (assign/completed)
// it uses the Firestore SDK with the local service account key
let firestore, FieldValue;
try {
  const {Firestore, FieldValue: FV} = require('@google-cloud/firestore');
  FieldValue = FV;
  const path = require('path');
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../backend/RideHub.Api/firebase-key.json');
  firestore = new Firestore({ keyFilename: keyPath });
} catch (e) {
  // sdk may not be installed; assignment features will silently skip
  firestore = null;
  FieldValue = null;
}

// some example locations/destinations
const LOCATIONS = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Naivasha',
  'Eldoret',
  'Diani',
  'Malindi',
  'Nakuru',
  'Thika',
  'Kitale'
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithin(days) {
  const now = Date.now();
  const future = now + Math.floor(Math.random() * days) * 24 * 60 * 60 * 1000;
  return new Date(future).toISOString();
}

function randomName() {
  const first = ['Alex','Sam','Chris','Pat','Jamie','Taylor','Jordan','Morgan','Casey','Riley'];
  const last = ['Smith','Johnson','Mbatha','Owino','Karanja','Mwangi','Otieno','Kamau','Wambua','Njoroge'];
  return `${randomItem(first)} ${randomItem(last)}`;
}

function randomComment() {
  const comments = [
    'Great service!',
    'Driver was late',
    'Very comfortable ride',
    'Would book again',
    'Not impressed',
    'Excellent experience',
    'Car was dirty',
    'Helpful driver',
    'Too expensive',
    'Smooth trip'
  ];
  return randomItem(comments);
}

async function registerTourist(email, fullName, password) {
  const payload = { email, password, fullName };
  // omit phoneNumber if we don't have a value
  // (API performs [Phone] validation that rejects empty string)
  const res = await fetch(`${API_BASE}/User/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`register failed: ${JSON.stringify(data)}`);
  return data.data;
}

// generalized user registration that can create drivers too
async function registerUser(email, fullName, password, role = 'Tourist') {
  try {
    const payload = { email, password, fullName, role };
    const res = await fetch(`${API_BASE}/User/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`register failed: ${JSON.stringify(data)}`);
    return data.data;
  } catch (err) {
    throw new Error(`fetch failed (${err.message})`);
  }
}

async function signInFirebase(email, password) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`signin failed: ${JSON.stringify(data)}`);
    return data.idToken;
  } catch (err) {
    throw new Error(`fetch failed (${err.message})`);
  }
}

async function createBooking(token, booking) {
  try {
    const res = await fetch(`${API_BASE}/Booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(booking)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`createBooking failed: ${JSON.stringify(data)}`);
    return data.data;
  } catch (err) {
    throw new Error(`fetch failed (${err.message})`);
  }
}

async function createFeedback(token, feedback) {
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(feedback)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`createFeedback failed: ${JSON.stringify(data)}`);
    return data.data;
  } catch (err) {
    throw new Error(`fetch failed (${err.message})`);
  }
}

(async () => {
  // parse command line args
  const args = process.argv.slice(2);
  const countArg = args.find(a => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 50;

  console.log(`Seeding ${count} tourist bookings...`);
  const password = 'Password123!';

  // build a pool of driver UIDs; if we have Firestore access we can read
  // existing drivers, otherwise we'll attempt to register new ones.
  const driverIds = [];
  if (firestore) {
    try {
      const snapshot = await firestore.collection('users').where('Role', '==', 'Driver').get();
      snapshot.forEach(doc => driverIds.push(doc.id));
      console.log(`Found ${driverIds.length} existing driver(s) in Firestore`);
    } catch (e) {
      console.warn('Error querying existing drivers:', e.message);
    }
  }

  // Ensure we have at least a few drivers to assign
  for (let d = 1; d <= 5 && driverIds.length < 5; d++) {
    const email = `driver${d}@example.com`;
    const name = `Driver ${d}`;
    try {
      const user = await registerUser(email, name, password, 'Driver');
      console.log(`Registered driver ${email}`);
      if (user?.uid) driverIds.push(user.uid);
      else if (user?.id) driverIds.push(user.id);
    } catch (e) {
      console.warn(`Could not register driver ${email}: ${e.message}`);
      // if registration failed because email exists but not added to list, attempt to fetch by querying again
      if (firestore) {
        try {
          const snap = await firestore.collection('users').where('Email', '==', email).get();
          snap.forEach(doc => {
            if (!driverIds.includes(doc.id)) driverIds.push(doc.id);
          });
        } catch {}
      }
    }
  }

  for (let i = 1; i <= count; i++) {
    const email = `tourist${i}@example.com`;
    const fullName = randomName();
    try {
      await registerTourist(email, fullName, password);
      console.log(`Registered ${email}`);
    } catch (e) {
      console.warn(`Could not register ${email}: ${e.message}`);
    }

    let token;
    try {
      token = await signInFirebase(email, password);
    } catch (e) {
      console.warn(`Signin failure for ${email}: ${e.message}`);
      continue;
    }

    const pickup = randomItem(LOCATIONS);
    let dest;
    do { dest = randomItem(LOCATIONS); } while (dest === pickup);

    const bookingObj = {
      bookingType: 'Transfer',
      serviceType: 'Transport',
      startDate: randomDateWithin(90), // vary over 90 days
      pickupLocation: pickup,
      destination: dest,
      price: Math.floor(Math.random() * 5000) + 1000,
      numberOfGuests: Math.ceil(Math.random() * 4),
      vehiclePreference: 'Any',
      specialRequests: '',
      // other fields are optional
    };

    let bookingResult;
    try {
      bookingResult = await createBooking(token, bookingObj);
      console.log(` Created booking ${bookingResult.id} for ${email}`);
    } catch (e) {
      console.warn(`Booking creation failed for ${email}: ${e.message}`);
    }

    // Randomly decide if booking is completed or cancelled
    if (bookingResult && bookingResult.id) {
      const isCompleted = Math.random() > 0.2; // 80% completed, 20% cancelled
      const status = isCompleted ? 'COMPLETED' : 'CANCELLED';

      if (isCompleted) {
        // Assign driver and complete
        const drv = driverIds.length ? randomItem(driverIds) : null;
        if (drv) {
          try {
            await firestore.collection('bookings').doc(bookingResult.id).update({
              assignedDriverId: drv,
              status: status,
              paymentStatus: 'PAID'
            });
            console.log(`  Booking ${bookingResult.id} updated with driver ${drv}, status ${status}`);

            // Calculate commission (10% of price)
            const commission = bookingObj.price * 0.1;
            await firestore.collection('users').doc(drv).update({
              CommissionBalance: FieldValue.increment(commission)
            });
            console.log(`  Commission ${commission} added to driver ${drv}`);
          } catch (updErr) {
            console.warn(`Firestore update failed for booking ${bookingResult.id}: ${updErr.message}`);
          }

          // Create feedback
          const feedbackObj = {
            bookingId: bookingResult.id,
            rating: Math.ceil(Math.random() * 5),
            comment: randomComment(),
            type: 'SERVICE',
            targetUserId: drv
          };
          try {
            await createFeedback(token, feedbackObj);
            console.log(`  Feedback created for ${email} targeting ${drv}`);
          } catch (e) {
            console.warn(`Could not create feedback for ${email}: ${e.message}`);
          }
        }
      } else {
        // Cancelled booking
        try {
          await firestore.collection('bookings').doc(bookingResult.id).update({
            status: status
          });
          console.log(`  Booking ${bookingResult.id} cancelled`);
        } catch (updErr) {
          console.warn(`Firestore update failed for booking ${bookingResult.id}: ${updErr.message}`);
        }
      }
    }

    // Add a tiny delay to avoid exploding the server
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('Seeding finished.');
})();
