
import React from 'react';
import { Trophy } from 'lucide-react';
import SignIn from '../components/SignIn';
import { User } from 'firebase/auth';

interface LandingPageProps {
  setUser: (user: User | null) => void;
  logoUrl?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ setUser, logoUrl }) => {

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 text-center relative overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ 
        backgroundImage: 'url("mezz.jpg")' 
      }}
    >
      {/* Heavy Green Overlay to match Masters Brand and ensure text readability */}
      <div className="absolute inset-0 bg-green-900/90 z-0"></div>
      
      <div className="z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-lg w-full flex flex-col items-center">
        <div className="mb-8 relative">
           <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-20 rounded-full"></div>
           {logoUrl ? (
              <img
                src={logoUrl}
                alt="Tournament Logo"
                className="h-32 w-32 object-cover rounded-full relative z-10 drop-shadow-2xl"
              />
           ) : (
              <div className="bg-yellow-400 p-6 rounded-full shadow-2xl border-4 border-green-800 relative z-10">
                  <Trophy className="h-16 w-16 text-green-900" />
              </div>
           )}
        </div>
        
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-4 tracking-tight drop-shadow-md">
          Welcome to <br/>
          <span className="text-yellow-400">Fantasy Golf</span>
        </h1>
        <p className="text-green-200 text-xl italic font-light mb-12 max-w-md mx-auto font-serif drop-shadow">
          &quot;A tradition similar to one other&quot;
        </p>

        <SignIn setUser={setUser} />
      </div>
      
      <footer className="absolute bottom-6 text-green-500/40 text-xs font-medium tracking-widest uppercase z-10">
        Fantasy Golf • Est. 2025
      </footer>
    </div>
  );
};

export default LandingPage;
