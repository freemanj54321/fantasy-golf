import React, { useState } from 'react';

interface VersionProps {
  className?: string;
  showBuildTime?: boolean;
}

export const Version: React.FC<VersionProps> = ({ className = '', showBuildTime = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  const version = __APP_VERSION__;
  const buildTime = __BUILD_TIME__;

  const formatBuildTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return (
    <div className={`text-sm text-gray-500 ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="hover:text-gray-700 transition-colors cursor-pointer focus:outline-none"
        title="Click for build details"
      >
        v{version}
      </button>

      {(showDetails || showBuildTime) && (
        <div className="text-xs mt-1 text-gray-400">
          Built: {formatBuildTime(buildTime)}
        </div>
      )}
    </div>
  );
};

export default Version;
