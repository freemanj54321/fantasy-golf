import React, { useState } from 'react';
import MastersResults from '../components/MastersResults';
import PlayerScorecardViewer from '../components/PlayerScorecardViewer';
import { useYear } from '../contexts/YearContext';

const MastersPage: React.FC = () => {
  const { year } = useYear();
  const mastersTournId = '014';

  const [selectedGolfer, setSelectedGolfer] = useState<{ id: string, name: string, roundTeeTimes?: Record<string, string | null> } | null>(null);

  const handleGolferClick = (golfer: { id: string, name: string, roundTeeTimes?: Record<string, string | null> }) => {
    setSelectedGolfer(golfer);
  };

  const handleCloseScorecard = () => {
    setSelectedGolfer(null);
  };

  return (
    <div className="container mx-auto px-1 sm:px-4 py-4 sm:py-8 relative">

      <main>
        <MastersResults
          year={year}
          tournId={mastersTournId}
          onGolferClick={handleGolferClick}
        />
      </main>

      {selectedGolfer && (
        <PlayerScorecardViewer
          playerId={selectedGolfer.id}
          playerName={selectedGolfer.name}
          tournId={mastersTournId}
          year={year}
          onClose={handleCloseScorecard}
          roundTeeTimes={selectedGolfer.roundTeeTimes}
        />
      )}
    </div>
  );
};

export default MastersPage;
