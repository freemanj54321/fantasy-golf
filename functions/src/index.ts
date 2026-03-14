import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";

const RAPIDAPI_API_KEY = defineSecret("RAPIDAPI_API_KEY");
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import {
  fetchPlayerScorecard,
  updatePlayerScorecardInFirestore,
  sleep,
  fetchWorldRankings,
  saveWorldRankingsInFirestore,
  syncPgaSchedule,
  fetchTournamentPlayers,
  saveTournamentPlayersInFirestore,
  fetchTournamentResults,
  saveTournamentResultsInFirestore,
  saveFantasyGolfResultsInFirestore,
  detectActiveTournament,
  fetchTournamentTeeTimes,
  saveTeeTimesInFirestore,
  extractTeeTimesFromPlayers,
  initializeScorecardSyncEntries,
  saveScorecardSyncEntries,
  clearTournamentResultsInFirestore,
  repopulateFromRawResultsInFirestore,
  populateScorecardSyncFromTeeTimes,
  updateScorecardSyncEntry,
} from "./rapidApi";

initializeApp();


export const listUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  try {
    const listUsersResult = await getAuth().listUsers();
    return {
      users: listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customClaims: userRecord.customClaims,
        disabled: userRecord.disabled,
      }))
    };
  } catch (error) {
    throw new HttpsError("internal", "Error listing users");
  }
});

export const setUserRole = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an administrator."
    );
  }

  const { uid, role } = request.data;

  try {
    await getAuth().setCustomUserClaims(uid, { admin: role === "Administrator" });
    return { message: `Success! ${uid} has been made a ${role}.` };
  } catch (error) {
    throw new HttpsError("internal", "Error setting user role");
  }
});

export const toggleUserDisabled = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an administrator."
    );
  }

  const { uid, disabled } = request.data;

  try {
    await getAuth().updateUser(uid, { disabled });
    return { message: `Success! User ${uid} has been ${disabled ? "disabled" : "enabled"}.` };
  } catch (error) {
    throw new HttpsError("internal", "Error updating user");
  }
});

export const createUser = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an administrator."
    );
  }

  const { email, password, displayName, role } = request.data;

  if (!email || !password) {
    throw new HttpsError(
      "invalid-argument",
      "Email and password are required."
    );
  }

  try {
    const userRecord = await getAuth().createUser({
      email,
      password,
      displayName: displayName || undefined,
    });

    if (role === "Administrator") {
      await getAuth().setCustomUserClaims(userRecord.uid, { admin: true });
    }

    return {
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customClaims: role === "Administrator" ? { admin: true } : {},
        disabled: false,
      },
    };
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "A user with this email already exists.");
    }
    if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email address.");
    }
    if (error.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Password is too weak.");
    }
    throw new HttpsError("internal", "Error creating user");
  }
});

export const deleteUser = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an administrator."
    );
  }

  const { uid } = request.data;

  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "User ID (uid) is required."
    );
  }

  try {
    await getAuth().deleteUser(uid);
    return { success: true, message: `Success! User ${uid} has been deleted.` };
  } catch (error: any) {
    throw new HttpsError("internal", `Error deleting user: ${error.message || "Unknown error"}`);
  }
});

export const updateUserName = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an administrator."
    );
  }

  const { uid, displayName } = request.data;

  if (!uid || displayName === undefined) {
    throw new HttpsError(
      "invalid-argument",
      "User ID (uid) and new displayName are required."
    );
  }

  try {
    const userRecord = await getAuth().updateUser(uid, {
      displayName: displayName.trim() === '' ? null : displayName.trim()
    });
    return { success: true, message: `Success! User ${uid} display name updated to ${userRecord.displayName || 'null'}.` };
  } catch (error: any) {
    throw new HttpsError("internal", `Error updating user name: ${error.message || "Unknown error"}`);
  }
});


export const autosyncRankings = onSchedule({ schedule: "0 0 * * 1", secrets: [RAPIDAPI_API_KEY] }, async (event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  if (!settings?.rankings?.enabled) {
    console.log("Rankings autosync is disabled.");
    return;
  }

  const { activeYear } = settings;
  if (!activeYear) return;

  const startedAt = Date.now();
  try {
    console.log(`Fetching world rankings for year ${activeYear}...`);
    const rankings = await fetchWorldRankings(activeYear.toString());
    console.log(`Fetched ${rankings.length} rankings from API. Saving to Firestore...`);
    const count = await saveWorldRankingsInFirestore(rankings, activeYear);
    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "rankings",
      status: "success",
      message: `Saved ${count} world rankings for ${activeYear}.`,
      details: {
        year: activeYear,
        rankingsReturned: rankings.length,
        rankingsSaved: count,
        elapsedMs: elapsed,
      }
    });
  } catch (err: any) {
    console.error("Failed to autosync rankings", err);
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "rankings",
      status: "error",
      message: err.message || "Failed to sync rankings.",
      details: { year: activeYear, error: err.message, elapsedMs: Date.now() - startedAt }
    });
  }
});

export const autosyncSchedule = onSchedule({ schedule: "30 0 * * 1", secrets: [RAPIDAPI_API_KEY] }, async (event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  if (!settings?.schedule?.enabled) {
    console.log("Schedule autosync is disabled.");
    return;
  }

  const { activeYear } = settings;
  if (!activeYear) return;

  const startedAt = Date.now();
  try {
    console.log(`Fetching PGA schedule for year ${activeYear}...`);
    const count = await syncPgaSchedule(activeYear.toString());
    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "schedule",
      status: "success",
      message: `Saved ${count} tournaments for ${activeYear}.`,
      details: {
        year: activeYear,
        tournamentsSaved: count,
        elapsedMs: elapsed,
      }
    });
  } catch (err: any) {
    console.error("Failed to autosync schedule", err);
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "schedule",
      status: "error",
      message: err.message || "Failed to sync schedule.",
      details: { year: activeYear, error: err.message, elapsedMs: Date.now() - startedAt }
    });
  }
});

export const autosyncTournamentField = onSchedule({ schedule: "0 0 * * *", secrets: [RAPIDAPI_API_KEY] }, async (event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  if (!settings?.tournamentField?.enabled) {
    console.log("Tournament Field autosync is disabled.");
    return;
  }

  // Active tournament is managed exclusively by autosyncActiveTournament — read it directly.
  const { activeTournamentId, activeYear } = settings;

  if (!activeTournamentId || !activeYear) return;

  const startedAt = Date.now();
  try {
    console.log(`Fetching tournament field for ${activeTournamentId} (${activeYear})...`);
    const players = await fetchTournamentPlayers(activeTournamentId, activeYear.toString());
    console.log(`Fetched ${players.length} players from API. Saving to Firestore...`);
    const count = await saveTournamentPlayersInFirestore(players, activeTournamentId, activeYear);

    const teeTimes = extractTeeTimesFromPlayers(players);
    console.log(`Extracted tee times for ${teeTimes.length} players. Saving to TeeTimes...`);
    const teeTimeCount = await saveTeeTimesInFirestore(teeTimes, activeTournamentId, activeYear);

    console.log(`Initializing Scorecard-Sync entries for ${teeTimes.length} players...`);
    const syncEntryCount = await initializeScorecardSyncEntries(teeTimes, activeTournamentId, activeYear);

    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentField",
      status: "success",
      message: `Saved ${count} players for tournament ${activeTournamentId} (${activeYear}). Saved tee times for ${teeTimeCount} players. Initialized ${syncEntryCount} Scorecard-Sync entries.`,
      tournamentId: activeTournamentId,
      details: {
        tournamentId: activeTournamentId,
        year: activeYear,
        playersReturned: players.length,
        playersSaved: count,
        teeTimesSaved: teeTimeCount,
        elapsedMs: elapsed,
      }
    });
  } catch (err: any) {
    console.error("Failed to autosync tournament players", err);
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentField",
      status: "error",
      message: err.message || "Failed to sync tournament field.",
      tournamentId: activeTournamentId,
      details: { tournamentId: activeTournamentId, year: activeYear, error: err.message, elapsedMs: Date.now() - startedAt }
    });
  }
});

export const autosyncTeeTimes = onSchedule({ schedule: "0 22 * * *", secrets: [RAPIDAPI_API_KEY] }, async (_event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  const { activeTournamentId, activeYear } = settings ?? {};
  if (!activeTournamentId || !activeYear) return;

  const startedAt = Date.now();
  try {
    console.log(`Fetching tee times for ${activeTournamentId} (${activeYear})...`);
    const players = await fetchTournamentTeeTimes(activeTournamentId, activeYear.toString());
    console.log(`Fetched tee times for ${players.length} players. Saving to Firestore...`);
    const count = await saveTeeTimesInFirestore(players, activeTournamentId, activeYear);
    const syncCount = await saveScorecardSyncEntries(players, activeTournamentId, activeYear);
    const { createdCount: seedCreated, updatedCount: seedUpdated } = await populateScorecardSyncFromTeeTimes(activeTournamentId, activeYear);
    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "teeTimes",
      status: "success",
      message: `Saved tee times for ${count} players. Updated ${syncCount} Scorecard-Sync entries. Seeded ${seedCreated} new / ${seedUpdated} updated Scorecard-Sync docs (${activeTournamentId}, ${activeYear}).`,
      tournamentId: activeTournamentId,
      details: {
        tournamentId: activeTournamentId,
        year: activeYear,
        playersSaved: count,
        syncEntriesUpdated: syncCount,
        seedCreated,
        seedUpdated,
        elapsedMs: elapsed,
      }
    });
  } catch (err: any) {
    console.error("Failed to autosync tee times", err);
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "teeTimes",
      status: "error",
      message: err.message || "Failed to sync tee times.",
      tournamentId: activeTournamentId,
      details: { tournamentId: activeTournamentId, year: activeYear, error: err.message, elapsedMs: Date.now() - startedAt }
    });
  }
});

export const autosyncTournamentResults = onSchedule({ schedule: "every 60 minutes", secrets: [RAPIDAPI_API_KEY] }, async (event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  if (!settings?.tournamentResults?.enabled) {
    console.log("Tournament Results autosync is disabled.");
    return;
  }

  // Active tournament is managed exclusively by autosyncActiveTournament — read it directly.
  const { activeTournamentId, activeYear, activeRound } = settings;

  if (!activeTournamentId || !activeYear || !activeRound) return;

  const startedAt = Date.now();
  try {
    console.log(`Fetching leaderboard for ${activeTournamentId} R${activeRound} (${activeYear})...`);
    const results = await fetchTournamentResults(activeTournamentId, activeYear.toString(), activeRound.toString());
    const leaderboardSize = results?.leaderboardRows?.length ?? 0;
    console.log(`Leaderboard returned ${leaderboardSize} rows. Saving to Tournament-Results...`);
    const count = await saveTournamentResultsInFirestore(results);

    console.log(`Bridging to FantasyGolf-Results...`);
    const mezzCount = await saveFantasyGolfResultsInFirestore(activeTournamentId, activeYear.toString(), activeRound.toString());
    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentResults",
      status: "success",
      message: `Saved ${count} player records for ${activeTournamentId} R${activeRound}. Bridged ${mezzCount} to FantasyGolf-Results.`,
      tournamentId: activeTournamentId,
      roundId: activeRound,
      details: {
        tournamentId: activeTournamentId,
        year: activeYear,
        round: activeRound,
        leaderboardRowsReturned: leaderboardSize,
        playersSaved: count,
        mezztersUpdated: mezzCount,
        elapsedMs: elapsed,
      }
    });
  } catch (err: any) {
    const is400 = err?.message?.includes("400") || err?.response?.status === 400;
    if (is400) {
      console.log(`No leaderboard data available for ${activeTournamentId} R${activeRound} (${activeYear}) — tournament may not have started yet.`);
      await db.collection("SyncLogs").add({
        timestamp: new Date(),
        type: "tournamentResults",
        status: "no-op",
        message: `No data (400): ${activeTournamentId} R${activeRound} ${activeYear} — tournament not started or no data for this round.`,
        tournamentId: activeTournamentId,
        roundId: activeRound,
        details: { tournamentId: activeTournamentId, year: activeYear, round: activeRound, elapsedMs: Date.now() - startedAt }
      });
    } else {
      console.error("Failed to autosync tournament results", err);
      await db.collection("SyncLogs").add({
        timestamp: new Date(),
        type: "tournamentResults",
        status: "error",
        message: err.message || "Failed to sync tournament results.",
        tournamentId: activeTournamentId,
        roundId: activeRound,
        details: { tournamentId: activeTournamentId, year: activeYear, round: activeRound, error: err.message, elapsedMs: Date.now() - startedAt }
      });
    }
  }
});

/**
 * Shared detection logic used by both the scheduled and on-demand functions.
 * Queries PGA-Schedule, finds the active tournament, and writes back to Settings/autosync.
 * Returns a summary string for logging.
 */
async function runTournamentDetection(db: Firestore, year: number): Promise<{ summary: string; details: Record<string, unknown> }> {
  const detected = await detectActiveTournament(year);
  const settingsRef = db.collection("Settings").doc("autosync");

  if (detected) {
    await settingsRef.set({
      activeTournamentId: detected.tournId,
      activeYear: year,
      activeRound: detected.roundId,
      autoDetectedTournamentName: detected.tournName,
      lastAutoDetection: new Date().toISOString(),
    }, { merge: true });

    const label = detected.isUpcoming ? "Next upcoming" : "Active";
    const summary = `${label}: ${detected.tournName} (Round ${detected.roundId}, ID: ${detected.tournId})`;
    return {
      summary,
      details: {
        tournamentId: detected.tournId,
        tournamentName: detected.tournName,
        round: detected.roundId,
        isUpcoming: detected.isUpcoming,
        startDate: new Date(detected.startDate).toISOString(),
        endDate: new Date(detected.endDate).toISOString(),
        year,
        detectedAt: new Date().toISOString(),
      }
    };
  } else {
    await settingsRef.set({
      autoDetectedTournamentName: '',
      lastAutoDetection: new Date().toISOString(),
    }, { merge: true });

    const summary = `No tournaments found in PGA-Schedule for year ${year}. Settings unchanged.`;
    return { summary, details: { year, detectedAt: new Date().toISOString() } };
  }
}

/**
 * Scheduled function that auto-detects the current week's tournament.
 * Runs every 4 hours so a missed midnight run is caught quickly.
 * Always uses the current calendar year to avoid stale activeYear issues.
 * Only acts when tournamentDetectionMode === 'auto'.
 */
export const autosyncActiveTournament = onSchedule("0 */4 * * *", async (event) => {
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) return;
  const settings = settingsDoc.data();

  if (settings?.tournamentDetectionMode !== "auto") {
    console.log("Tournament detection mode is manual. Skipping auto-detection.");
    return;
  }

  const year: number = new Date().getFullYear();
  console.log(`Running auto-detection for year ${year}...`);

  try {
    const { summary, details } = await runTournamentDetection(db, year);
    console.log(summary);

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentDetection",
      status: "success",
      message: summary,
      details,
    });
  } catch (err: any) {
    console.error("Failed to auto-detect tournament", err);
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentDetection",
      status: "error",
      message: err.message || "Failed to detect tournament.",
      details: { error: err.message }
    });
  }
});

/**
 * On-demand admin callable that triggers tournament detection immediately.
 * Powers the "Detect Now" button in the AutoSync admin UI.
 */
export const detectActiveTournamentNow = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }

  const db = getFirestore();
  const year: number = new Date().getFullYear();

  try {
    const { summary, details } = await runTournamentDetection(db, year);

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "tournamentDetection",
      status: "success",
      message: `[Manual] ${summary}`,
      details,
    });

    return { success: true, message: summary };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to detect tournament.");
  }
});

export const syncTeeTimesNow = onCall({ secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }

  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) {
    throw new HttpsError("not-found", "Settings/autosync document not found.");
  }

  const settings = settingsDoc.data();
  const { activeTournamentId, activeYear } = settings ?? {};

  if (!activeTournamentId || !activeYear) {
    throw new HttpsError("failed-precondition", "No active tournament configured in Settings/autosync.");
  }

  const startedAt = Date.now();
  try {
    console.log(`[Manual] Fetching tee times for ${activeTournamentId} (${activeYear})...`);
    const players = await fetchTournamentTeeTimes(activeTournamentId, activeYear.toString());
    console.log(`[Manual] Fetched tee times for ${players.length} players. Saving to Firestore...`);
    const count = await saveTeeTimesInFirestore(players, activeTournamentId, activeYear);
    const syncCount = await saveScorecardSyncEntries(players, activeTournamentId, activeYear);
    const elapsed = Date.now() - startedAt;

    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "teeTimes",
      status: "success",
      message: `[Manual] Saved tee times for ${count} players. Updated ${syncCount} Scorecard-Sync entries (${activeTournamentId}, ${activeYear}).`,
      tournamentId: activeTournamentId,
      details: { tournamentId: activeTournamentId, year: activeYear, playersSaved: count, syncEntriesUpdated: syncCount, elapsedMs: elapsed }
    });

    return { success: true, message: `Saved tee times for ${count} players. Updated ${syncCount} Scorecard-Sync entries.` };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to sync tee times.");
  }
});

export const syncRankingsNow = onCall({ secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();
  if (!settingsDoc.exists) throw new HttpsError("not-found", "Settings/autosync document not found.");
  const { activeYear } = settingsDoc.data() ?? {};
  if (!activeYear) throw new HttpsError("failed-precondition", "No active year configured in Settings/autosync.");

  try {
    const rankings = await fetchWorldRankings(activeYear.toString());
    await saveWorldRankingsInFirestore(rankings, activeYear);
    const msg = `Synced ${rankings.length} world rankings for ${activeYear}.`;
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "rankings", status: "success", message: `[Manual] ${msg}` });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to sync rankings.");
  }
});

export const syncScheduleNow = onCall({ secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();
  if (!settingsDoc.exists) throw new HttpsError("not-found", "Settings/autosync document not found.");
  const { activeYear } = settingsDoc.data() ?? {};
  if (!activeYear) throw new HttpsError("failed-precondition", "No active year configured in Settings/autosync.");

  try {
    const count = await syncPgaSchedule(activeYear.toString());
    const msg = `Synced ${count} schedule entries for ${activeYear}.`;
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "schedule", status: "success", message: `[Manual] ${msg}` });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to sync schedule.");
  }
});

export const syncTournamentFieldNow = onCall({ secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();
  if (!settingsDoc.exists) throw new HttpsError("not-found", "Settings/autosync document not found.");
  const { activeTournamentId, activeYear } = settingsDoc.data() ?? {};
  if (!activeTournamentId || !activeYear) {
    throw new HttpsError("failed-precondition", "No active tournament configured in Settings/autosync.");
  }

  try {
    const players = await fetchTournamentPlayers(activeTournamentId, activeYear.toString());
    await saveTournamentPlayersInFirestore(players, activeTournamentId, activeYear);
    const teeTimes = extractTeeTimesFromPlayers(players);
    await saveTeeTimesInFirestore(teeTimes, activeTournamentId, activeYear);
    const syncCount = await initializeScorecardSyncEntries(teeTimes, activeTournamentId, activeYear);
    const msg = `Synced ${players.length} players, ${teeTimes.length} with tee times, ${syncCount} Scorecard-Sync entries (${activeTournamentId}, ${activeYear}).`;
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "tournamentField", status: "success", message: `[Manual] ${msg}`, tournamentId: activeTournamentId });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to sync tournament field.");
  }
});

export const syncTournamentResultsNow = onCall({ secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const { tournId, year, roundId } = (request.data ?? {}) as { tournId: string; year: number; roundId: string };
  if (!tournId || !year || !roundId) {
    throw new HttpsError("invalid-argument", "tournId, year, and roundId are required.");
  }

  try {
    const results = await fetchTournamentResults(tournId, year.toString(), roundId.toString());
    const saved = await saveTournamentResultsInFirestore(results);
    await saveFantasyGolfResultsInFirestore(tournId, year, roundId);
    const msg = `Synced ${saved} player results for ${tournId} R${roundId} (${year}).`;
    const db = getFirestore();
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "tournamentResults", status: "success", message: `[Manual] ${msg}`, tournamentId: tournId });
    return { success: true, message: msg };
  } catch (err: any) {
    console.error(`[syncTournamentResultsNow] Error for ${tournId} R${roundId} (${year}):`, err?.message, err?.stack);
    throw new HttpsError("internal", err.message || "Failed to sync tournament results.");
  }
});

export const syncFantasyGolfResultsNow = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const { tournId, year } = (request.data ?? {}) as { tournId: string; year: number };
  if (!tournId || !year) {
    throw new HttpsError("invalid-argument", "tournId and year are required.");
  }

  try {
    let totalSaved = 0;
    for (const roundId of [1, 2, 3, 4]) {
      totalSaved += await saveFantasyGolfResultsInFirestore(tournId, year, roundId);
    }
    const msg = `Force-synced FantasyGolf Results for all 4 rounds of ${tournId} (${year}). ${totalSaved} player records updated.`;
    const db = getFirestore();
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "fantasyGolfResults", status: "success", message: `[Manual] ${msg}`, tournamentId: tournId });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to sync FantasyGolf results.");
  }
});


export const clearTournamentResultsNow = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const { tournId, year } = (request.data ?? {}) as { tournId: string; year: number };
  if (!tournId || !year) {
    throw new HttpsError("invalid-argument", "tournId and year are required.");
  }

  try {
    const { deletedCount } = await clearTournamentResultsInFirestore(tournId, year);
    const msg = `Cleared ${deletedCount} results records for ${tournId} (${year}).`;
    const db = getFirestore();
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "clearResults", status: "success", message: `[Manual] ${msg}`, tournamentId: tournId });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to clear tournament results.");
  }
});

export const repopulateResultsNow = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }
  const { tournId, year } = (request.data ?? {}) as { tournId: string; year: number };
  if (!tournId || !year) {
    throw new HttpsError("invalid-argument", "tournId and year are required.");
  }

  try {
    const { createdCount } = await repopulateFromRawResultsInFirestore(tournId, year);
    const msg = `Repopulated ${createdCount} player-round records for ${tournId} (${year}).`;
    const db = getFirestore();
    await db.collection("SyncLogs").add({ timestamp: new Date(), type: "repopulate", status: "success", message: `[Manual] ${msg}`, tournamentId: tournId });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to repopulate results.");
  }
});

export const seedScorecardSyncNow = onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }

  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();

  if (!settingsDoc.exists) {
    throw new HttpsError("not-found", "Settings/autosync document not found.");
  }

  const settings = settingsDoc.data();
  const { activeTournamentId, activeYear } = settings ?? {};

  if (!activeTournamentId || !activeYear) {
    throw new HttpsError("failed-precondition", "No active tournament configured in Settings/autosync.");
  }

  try {
    const { createdCount, updatedCount } = await populateScorecardSyncFromTeeTimes(activeTournamentId, activeYear);
    const msg = `Scorecard-Sync seeded: ${createdCount} created, ${updatedCount} updated (${activeTournamentId}, ${activeYear}).`;
    await db.collection("SyncLogs").add({
      timestamp: new Date(),
      type: "scorecardSync",
      status: "success",
      message: `[Manual] ${msg}`,
      tournamentId: activeTournamentId,
    });
    return { success: true, message: msg };
  } catch (err: any) {
    throw new HttpsError("internal", err.message || "Failed to seed Scorecard-Sync.");
  }
});

export const syncScorecardsV2Now = onCall({ timeoutSeconds: 540, secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }

  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();
  if (!settingsDoc.exists) throw new HttpsError("not-found", "Settings/autosync document not found.");

  const settings = settingsDoc.data();
  const { activeTournamentId, activeYear, activeRound } = settings ?? {};
  if (!activeTournamentId || !activeYear || !activeRound) {
    throw new HttpsError("failed-precondition", "No active tournament configured in Settings/autosync.");
  }

  const now = Date.now();
  const INTERVAL_MS = 30 * 60 * 1000;

  const syncSnapshot = await db.collection("Scorecard-Sync")
    .where("tournId", "==", activeTournamentId)
    .where("year", "==", activeYear)
    .where("roundId", "==", activeRound)
    .get();

  const eligible: Array<{ docId: string; playerId: string }> = [];
  let skippedComplete = 0;
  let skippedNoTeeTime = 0;
  let skippedTeeTimeNotYet = 0;

  for (const doc of syncSnapshot.docs) {
    const d = doc.data();
    if (d.roundComplete === true)  { skippedComplete++;      continue; }
    if (!d.teeTimeTimestamp)       { skippedNoTeeTime++;     continue; }
    const teeTimeMs = typeof d.teeTimeTimestamp === 'number'
      ? d.teeTimeTimestamp
      : new Date(d.teeTimeTimestamp).getTime();
    if (teeTimeMs > now)           { skippedTeeTimeNotYet++; continue; }
    eligible.push({ docId: doc.id, playerId: String(d.playerId) });
  }

  let successCount = 0;
  const failedPlayerIds: string[] = [];

  for (const { docId, playerId } of eligible) {
    try {
      const scorecardData = await fetchPlayerScorecard(activeTournamentId, String(activeYear), playerId);
      await updatePlayerScorecardInFirestore(activeTournamentId, activeYear, activeRound, playerId, scorecardData);
      const roundComplete = scorecardData.some(s => {
        const id = typeof s.roundId === 'object'
          ? parseInt((s.roundId as any).$numberInt, 10)
          : Number(s.roundId);
        return id === activeRound && Boolean(s.roundComplete);
      });
      await updateScorecardSyncEntry(docId, roundComplete, INTERVAL_MS);
      successCount++;
      await sleep(150);
    } catch (err: any) {
      failedPlayerIds.push(playerId);
    }
  }

  let mezzCount = 0;
  if (successCount > 0) {
    mezzCount = await saveFantasyGolfResultsInFirestore(activeTournamentId, activeYear.toString(), activeRound.toString());
  }

  const msg = `[Manual] Synced ${successCount}/${eligible.length} eligible. Bridged ${mezzCount} to FantasyGolf-Results. Skipped: ${skippedComplete} complete, ${skippedTeeTimeNotYet} not yet started, ${skippedNoTeeTime} no tee time. Round ${activeRound}.`;
  await db.collection("SyncLogs").add({
    timestamp: new Date(), type: "scorecards", status: successCount > 0 ? "success" : eligible.length === 0 ? "no-op" : "error",
    message: msg, tournamentId: activeTournamentId, roundId: activeRound,
    details: { tournamentId: activeTournamentId, year: activeYear, round: activeRound, eligible: eligible.length, synced: successCount, failed: failedPlayerIds.length, failedPlayerIds, skippedComplete, skippedTeeTimeNotYet, skippedNoTeeTime, mezztersUpdated: mezzCount },
  });
  return { success: true, message: msg };
});

// Fetches scorecards for ALL players in the tournament field (ignores tee time eligibility).
// Updates Scorecard-Sync entries with lastCheck/roundComplete but does NOT use them as a filter.
export const fetchAllScorecardsNow = onCall({ timeoutSeconds: 540, secrets: [RAPIDAPI_API_KEY] }, async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "The function must be called by an administrator.");
  }

  const db = getFirestore();
  const settingsDoc = await db.collection("Settings").doc("autosync").get();
  if (!settingsDoc.exists) throw new HttpsError("not-found", "Settings/autosync document not found.");

  const settings = settingsDoc.data();
  const { activeTournamentId, activeYear } = settings ?? {};
  if (!activeTournamentId || !activeYear) {
    throw new HttpsError("failed-precondition", "No active tournament configured in Settings/autosync.");
  }

  // Get all players in the tournament field
  const fieldSnapshot = await db.collection("Tournament-Field")
    .where("tournId", "==", activeTournamentId)
    .where("year", "==", activeYear)
    .get();

  if (fieldSnapshot.empty) {
    throw new HttpsError("failed-precondition", `No players found in Tournament-Field for ${activeTournamentId} (${activeYear}). Sync the tournament field first.`);
  }

  const playerIds = fieldSnapshot.docs.map(d => String(d.data().playerId)).filter(Boolean);
  const ROUNDS = [1, 2, 3, 4];
  const INTERVAL_MS = 30 * 60 * 1000;

  let successCount = 0;
  const failedPlayerIds: string[] = [];

  for (const playerId of playerIds) {
    try {
      const scorecardData = await fetchPlayerScorecard(activeTournamentId, String(activeYear), playerId);

      // Save scorecard for all rounds
      for (const roundId of ROUNDS) {
        await updatePlayerScorecardInFirestore(activeTournamentId, activeYear, roundId, playerId, scorecardData);

        // Update Scorecard-Sync entry if it exists (don't create; just update stats)
        const syncDocId = `${activeYear}-${activeTournamentId}-${playerId}-${roundId}`;
        const syncDoc = await db.collection("Scorecard-Sync").doc(syncDocId).get();
        if (syncDoc.exists) {
          const roundComplete = scorecardData.some(s => {
            const id = typeof s.roundId === "number" ? s.roundId : parseInt(String(s.roundId), 10);
            return id === roundId && s.roundComplete;
          });
          await updateScorecardSyncEntry(syncDocId, roundComplete, INTERVAL_MS);
        }
      }

      successCount++;
      await sleep(150);
    } catch (err: any) {
      failedPlayerIds.push(playerId);
      console.error(`[FetchAllScorecards] Failed for player ${playerId}:`, err?.message);
    }
  }

  const msg = `[Manual] Fetched all scorecards: ${successCount}/${playerIds.length} players synced (all rounds). ${failedPlayerIds.length} failed. Tournament: ${activeTournamentId} (${activeYear}).`;
  await db.collection("SyncLogs").add({
    timestamp: new Date(),
    type: "scorecards",
    status: successCount > 0 ? "success" : "error",
    message: msg,
    tournamentId: activeTournamentId,
    details: { tournamentId: activeTournamentId, year: activeYear, totalPlayers: playerIds.length, synced: successCount, failed: failedPlayerIds.length, failedPlayerIds },
  });
  return { success: true, message: msg };
});

export const autosyncScorecardsV2 = onSchedule(
  { schedule: "every 30 minutes", secrets: [RAPIDAPI_API_KEY] },
  async () => {
    const db = getFirestore();

    const settingsDoc = await db.collection("Settings").doc("autosync").get();
    if (!settingsDoc.exists) return;
    const settings = settingsDoc.data();
    if (!settings?.scorecards?.enabled) {
      console.log("[ScorecardsV2] Disabled in Settings/autosync.");
      return;
    }

    const { activeTournamentId, activeYear, activeRound } = settings;
    if (!activeTournamentId || !activeYear || !activeRound) {
      console.log("[ScorecardsV2] Missing active tournament config.");
      return;
    }

    const now = Date.now();
    const INTERVAL_MS = 30 * 60 * 1000;

    const syncSnapshot = await db.collection("Scorecard-Sync")
      .where("tournId", "==", activeTournamentId)
      .where("year", "==", activeYear)
      .where("roundId", "==", activeRound)
      .get();

    const eligible: Array<{ docId: string; playerId: string }> = [];
    let skippedComplete = 0;
    let skippedNoTeeTime = 0;
    let skippedTeeTimeNotYet = 0;

    for (const doc of syncSnapshot.docs) {
      const d = doc.data();
      if (d.roundComplete === true)  { skippedComplete++;      continue; }
      if (!d.teeTimeTimestamp)       { skippedNoTeeTime++;     continue; }
      const teeTimeMs = typeof d.teeTimeTimestamp === 'number'
        ? d.teeTimeTimestamp
        : new Date(d.teeTimeTimestamp).getTime();
      if (teeTimeMs > now)           { skippedTeeTimeNotYet++; continue; }
      eligible.push({ docId: doc.id, playerId: String(d.playerId) });
    }

    console.log(`[ScorecardsV2] Eligible playerIds: ${eligible.map(e => e.playerId).join(", ") || "none"}`);

    let successCount = 0;
    const failedPlayerIds: string[] = [];

    for (const { docId, playerId } of eligible) {
      try {
        const scorecardData = await fetchPlayerScorecard(activeTournamentId, String(activeYear), playerId);
        await updatePlayerScorecardInFirestore(activeTournamentId, activeYear, activeRound, playerId, scorecardData);
        const roundComplete = scorecardData.some(s => {
          const id = typeof s.roundId === 'object'
            ? parseInt((s.roundId as any).$numberInt, 10)
            : Number(s.roundId);
          return id === activeRound && Boolean(s.roundComplete);
        });
        await updateScorecardSyncEntry(docId, roundComplete, INTERVAL_MS);
        successCount++;
        await sleep(150);
      } catch (err: any) {
        failedPlayerIds.push(playerId);
        console.error(`[ScorecardsV2] Failed for player ${playerId}:`, err?.message);
      }
    }

    let mezzCount = 0;
    if (successCount > 0) {
      mezzCount = await saveFantasyGolfResultsInFirestore(activeTournamentId, activeYear.toString(), activeRound.toString());
    }

    const status = successCount > 0 ? "success" : eligible.length === 0 ? "no-op" : "error";
    try {
      await db.collection("SyncLogs").add({
        timestamp: new Date(),
        type: "scorecards",
        status,
        message: `Synced ${successCount}/${eligible.length} eligible. Bridged ${mezzCount} to FantasyGolf-Results. Skipped: ${skippedComplete} complete, ${skippedTeeTimeNotYet} not yet started, ${skippedNoTeeTime} no tee time. Round ${activeRound}.`,
        tournamentId: activeTournamentId,
        roundId: activeRound,
        details: {
          tournamentId: activeTournamentId,
          year: activeYear,
          round: activeRound,
          eligible: eligible.length,
          synced: successCount,
          failed: failedPlayerIds.length,
          failedPlayerIds,
          skippedComplete,
          skippedTeeTimeNotYet,
          skippedNoTeeTime,
          mezztersUpdated: mezzCount,
        },
      });
    } catch (logErr) {
      console.error("[ScorecardsV2] Failed to write SyncLog:", logErr);
    }
  }
);
