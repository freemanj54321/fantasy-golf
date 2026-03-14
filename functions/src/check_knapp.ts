import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

try {
    initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID"
    });
} catch (e) {
    // Ignore initialize error
}

const db = getFirestore();

async function checkKnapp() {
    console.log("Checking raw-tournament-results...");
    const rawQuery = await db.collection("raw-tournament-results").get();

    for (const doc of rawQuery.docs) {
        const data = doc.data();
        const rows = data.leaderboardRows;
        if (rows && Array.isArray(rows)) {
            const knapp = rows.find(r => r.lastName === 'Knapp' && r.firstName === 'Jake');
            if (knapp) {
                console.log(`Found Jake Knapp in raw data: ${doc.id}`);
                console.log(JSON.stringify(knapp, null, 2));
            }
        }
    }

    console.log("Checking Tournament-Results...");
    const trQuery = await db.collection("Tournament-Results").where("lastName", "==", "Knapp").get();
    if (trQuery.empty) {
        console.log("Knapp NOT found in Tournament-Results.");
    } else {
        for (const doc of trQuery.docs) {
            const data = doc.data();
            if (data.firstName === 'Jake') {
                console.log(`Found Jake Knapp in Tournament-Results: ${doc.id}`);
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }
}

checkKnapp().catch(console.error);
