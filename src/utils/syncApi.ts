import { getFunctions, httpsCallable, Functions } from "firebase/functions";
import { getApp } from "firebase/app";
import { callWithRetry } from './userApi';

const functions: Functions = getFunctions(getApp());

interface SyncResponse { success: boolean; message: string; }
interface TournamentSyncRequest { tournId: string; year: number; }
interface ResultsSyncRequest { tournId: string; year: number; roundId: string | number; }

const syncRankingsNowCallable = httpsCallable<void, SyncResponse>(functions, 'syncRankingsNow');
const syncScheduleNowCallable = httpsCallable<void, SyncResponse>(functions, 'syncScheduleNow');
const syncTournamentFieldNowCallable = httpsCallable<void, SyncResponse>(functions, 'syncTournamentFieldNow');
const syncTournamentResultsNowCallable = httpsCallable<ResultsSyncRequest, SyncResponse>(functions, 'syncTournamentResultsNow');
const syncFantasyGolfResultsNowCallable = httpsCallable<TournamentSyncRequest, SyncResponse>(functions, 'syncFantasyGolfResultsNow');
const syncTeeTimesNowCallable = httpsCallable<void, SyncResponse>(functions, 'syncTeeTimesNow');
const clearTournamentResultsNowCallable = httpsCallable<TournamentSyncRequest, SyncResponse>(functions, 'clearTournamentResultsNow');
const repopulateResultsNowCallable = httpsCallable<TournamentSyncRequest, SyncResponse>(functions, 'repopulateResultsNow');
const seedScorecardSyncNowCallable = httpsCallable<void, SyncResponse>(functions, 'seedScorecardSyncNow');
const syncScorecardsV2NowCallable = httpsCallable<void, SyncResponse>(functions, 'syncScorecardsV2Now', { timeout: 540000 });
const fetchAllScorecardsNowCallable = httpsCallable<void, SyncResponse>(functions, 'fetchAllScorecardsNow', { timeout: 540000 });

export const sync_rankings_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => syncRankingsNowCallable(), 'Sync Rankings');

export const sync_schedule_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => syncScheduleNowCallable(), 'Sync Schedule');

export const sync_tournament_field_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => syncTournamentFieldNowCallable(), 'Sync Tournament Field');

export const sync_tournament_results_now = (data: ResultsSyncRequest): Promise<SyncResponse> =>
    callWithRetry<ResultsSyncRequest, SyncResponse>(() => syncTournamentResultsNowCallable(data), 'Sync Tournament Results');

export const sync_fantasy_golf_results_now = (data: TournamentSyncRequest): Promise<SyncResponse> =>
    callWithRetry<TournamentSyncRequest, SyncResponse>(() => syncFantasyGolfResultsNowCallable(data), 'Sync FantasyGolf Results');

export const sync_tee_times_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => syncTeeTimesNowCallable(), 'Sync Tee Times');

export const clear_tournament_results_now = (data: TournamentSyncRequest): Promise<SyncResponse> =>
    callWithRetry<TournamentSyncRequest, SyncResponse>(() => clearTournamentResultsNowCallable(data), 'Clear Tournament Results');

export const repopulate_results_now = (data: TournamentSyncRequest): Promise<SyncResponse> =>
    callWithRetry<TournamentSyncRequest, SyncResponse>(() => repopulateResultsNowCallable(data), 'Repopulate Results');

export const seed_scorecard_sync_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => seedScorecardSyncNowCallable(), 'Seed Scorecard Sync');

export const sync_scorecards_v2_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => syncScorecardsV2NowCallable(), 'Sync Scorecards V2');

export const fetch_all_scorecards_now = (): Promise<SyncResponse> =>
    callWithRetry<void, SyncResponse>(() => fetchAllScorecardsNowCallable(), 'Fetch All Scorecards');
