import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(config);
const db = getFirestore(app);

async function checkKnapp() {
    console.log("Checking raw-tournament-results...");
    const rawQuery = await getDocs(collection(db, "raw-tournament-results"));
    for (const doc of rawQuery.docs) {
        const data = doc.data();
        const rows = data.leaderboardRows;
        if (rows && Array.isArray(rows)) {
            const knapp = rows.find(r => r.lastName === 'Knapp' && r.firstName === 'Jake');
            if (knapp) {
                console.log(`Found Jake Knapp in raw data: ${doc.id}`);
                // console.log(JSON.stringify(knapp, null, 2));
            }
        }
    }

    console.log("Checking Tournament-Results for Jake Knapp...");
    const trQuery = await getDocs(query(collection(db, "Tournament-Results"), where("lastName", "==", "Knapp")));
    if (trQuery.empty) {
        console.log("Knapp NOT found in Tournament-Results.");
    } else {
        for (const doc of trQuery.docs) {
            if (doc.data().firstName === 'Jake') {
                console.log(`Found Jake Knapp in Tournament-Results: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            }
        }
    }
}

checkKnapp().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
