
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Version from './components/Version';
import { YearProvider } from './contexts/YearContext';
import { LeagueSettings } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import useAdmin from './hooks/useAdmin';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "./App.css";
import useLeagueSettings from './hooks/useLeagueSettings';

// Create a client
const queryClient = new QueryClient();

// Lazy-loaded page components
const MastersPage = lazy(() => import('./pages/MastersPage'));
const RankingsPage = lazy(() => import('./pages/RankingsPage'));
const DraftPage = lazy(() => import('./pages/DraftPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const RoleManagementPage = lazy(() => import('./pages/RoleManagementPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AutoSyncPage = lazy(() => import('./pages/AutoSyncPage'));
const CurrentTournamentPage = lazy(() => import('./pages/CurrentTournamentPage'));
const TeamManagementPage = lazy(() => import('./pages/TeamManagementPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChampionsLockerRoomPage = lazy(() => import('./pages/ChampionsLockerRoomPage'));

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-green-800"></div>
  </div>
);

function GlobalProviders() {
  // We use a wrapper component just inside YearProvider so useYear is available
  const { settings, loading: settingsLoading } = useLeagueSettings();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isAdmin, loading: adminLoading } = useAdmin(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Show loading spinner while checking auth, admin status, or loading settings
  if (authLoading || (user && adminLoading) || settingsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="App">
        {user && (
          <Header
            settings={settings}
            isAdmin={isAdmin}
          />
        )}
        <main className={user ? "App-content" : ""}>
          <Suspense fallback={<div className='p-8'><LoadingSpinner /></div>}>
            <Routes>
              {!user ? (
                <Route path="*" element={<LandingPage logoUrl={settings.tournamentLogoUrl} setUser={setUser} />} />
              ) : (
                <>
                  <Route path="/" element={<LeaderboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/champions" element={<ChampionsLockerRoomPage />} />
                  <Route path="/masters" element={<MastersPage />} />
                  <Route path="/rankings" element={<RankingsPage />} />
                  <Route path="/draft" element={<DraftPage />} />
                  <Route path="/teams" element={<TeamsPage userRole={isAdmin ? 'administrator' : 'user'} />} />
                  {isAdmin && (
                    <>
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/admin/roles" element={<RoleManagementPage />} />
                      <Route path="/admin/autosync" element={<AutoSyncPage />} />
                      <Route path="/admin/teams" element={<TeamManagementPage />} />
                      <Route path="/masters/current" element={<CurrentTournamentPage />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              )}
            </Routes>
          </Suspense>
        </main>
        {user && (
          <footer className="App-footer">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p>© {new Date().getFullYear()} Fantasy Golf. All rights reserved.</p>
              <Version />
            </div>
          </footer>
        )}
      </div>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YearProvider>
        <GlobalProviders />
      </YearProvider>
    </QueryClientProvider>
  );
}

export default App;
