
# Project Overview

This project is a fantasy golf application. It allows users to view player rankings, create teams, and participate in a draft. The application uses React and Firebase.

# Implemented Features

*   **World Golf Rankings:** Displays the latest world golf rankings with sorting, filtering, and pagination.
*   **User Authentication:** Users can sign in to the application.
*   **Team Management:** Authenticated users can create and manage their fantasy golf teams.
*   **Draft:** Users can participate in a fantasy draft.
*   **Admin Page:** A new page for administrators to manage the application's data.

# Current Task: Analyze RapidAPI Integration and Plan Scorecard Retrieval

**Overview of Current RapidAPI Integration:**

1.  **Configuration:** The app uses `VITE_RAPIDAPI_API_KEY` and specific API hosts defined in `.env.example`, accessed via `rapidApiConfig.ts`.
2.  **Core Client (`RapidApiClient`):** All requests are routed through a robust internal API client in `rapidApiService.ts`. This client features:
    *   **Caching:** 5-minute Time-To-Live (TTL) for fetched endpoints.
    *   **Rate Limiting:** Enforces a 100ms delay between requests to avoid API throttling.
    *   **Retry with Backoff:** Automatically retries failed requests up to 3 times with exponential backoff (starting at 1s delay).
    *   **Timeout & Cancellation:** 30-second default timeout, with support for aborting requests.
3.  **Current API Calls:** The service currently fetches:
    *   `fetchWorldRankings`: World golf rankings.
    *   `fetchPgaSchedule`: PGA Tour schedules by year.
    *   `fetchTournamentPlayers`: Field of players for a specific tournament.
    *   `fetchTournamentResults`: Leaderboard and round results for a tournament.
4.  **Firebase Syncing:** After data is fetched, it is transformed (handling RapidAPI's `$numberInt` wrapper format) and synced to various Firebase collections (e.g., `golf-rankings`, `raw-tournament-results`, `Tournament-Results`, `Mezzters-Results`).

**Plan for Retrieving Individual Player Scorecards:**

1.  **Identify Endpoint:** Locate the specific RapidAPI endpoint providing hole-by-hole or detailed scorecard data for a player in a given tournament round.
2.  **Add API Method:** Create a `fetchPlayerScorecard(tournId, year, playerId)` method in `rapidApiService.ts` leveraging the existing `apiClient.get()` implementation to inherit caching and retry logic.
3.  **Firebase Integration:** Create a `savePlayerScorecard` syncing method to structure and store the detailed scoring data in Firestore (potentially linked to the `Mezzters-Results` or a new collection).
4.  **UI Updates:** Update the front-end components to query and display this new scorecard data.
