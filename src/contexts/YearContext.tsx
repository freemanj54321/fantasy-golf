import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface YearContextType {
  year: number;
  setYear: (year: number) => void;
  availableYears: number[];
}

const YearContext = createContext<YearContextType | undefined>(undefined);

interface YearProviderProps {
  children: ReactNode;
}

const SETTINGS_DOC = doc(db, 'Settings', 'autosync');
const AVAILABLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021];

const getDefaultYear = (): number => {
  const now = new Date().getFullYear();
  return AVAILABLE_YEARS.includes(now) ? now : AVAILABLE_YEARS[0];
};

export const YearProvider: React.FC<YearProviderProps> = ({ children }) => {
  const [year, setYearState] = useState<number>(getDefaultYear);
  // Track whether the initial server value has been applied so we don't
  // overwrite a user's manual selection when the snapshot fires again.
  const initialised = useRef(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_DOC,
      (snap) => {
        if (!initialised.current) {
          // Apply the server's activeYear on first load only
          const serverYear = snap.exists() ? (snap.data().activeYear as number | undefined) : undefined;
          if (serverYear && AVAILABLE_YEARS.includes(serverYear)) {
            setYearState(serverYear);
          }
          initialised.current = true;
        }
      },
      (err) => {
        console.warn('YearContext: could not read Settings/autosync, using default year', err);
        initialised.current = true;
      }
    );
    return () => unsubscribe();
  }, []);

  const setYear = (newYear: number) => {
    if (!AVAILABLE_YEARS.includes(newYear)) {
      console.warn(`Year ${newYear} is not in available years`);
      return;
    }
    setYearState(newYear);
    // Persist to Firestore so the selection survives cache clears and is shared across sessions
    setDoc(SETTINGS_DOC, { activeYear: newYear }, { merge: true }).catch((err) => {
      console.error('YearContext: failed to persist year to Firestore', err);
    });
  };

  return (
    <YearContext.Provider value={{ year, setYear, availableYears: AVAILABLE_YEARS }}>
      {children}
    </YearContext.Provider>
  );
};

export const useYear = (): YearContextType => {
  const context = useContext(YearContext);
  if (context === undefined) {
    throw new Error('useYear must be used within a YearProvider');
  }
  return context;
};

export default YearContext;
