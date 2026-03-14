import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, ArrowRight } from 'lucide-react';

interface SignInProps {
  setUser: (user: User | null) => void;
}

const SignIn: React.FC<SignInProps> = ({ setUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, try to sign in
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
    } catch (err) {
      const errorCode = (err as any).code;

      // If the user doesn't exist or we hit an invalid credential due to no account
      // We attempt to create the account gracefully
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
        try {
          const newResult = await createUserWithEmailAndPassword(auth, email, password);
          setUser(newResult.user);
        } catch (createErr) {
          // Handle case where password might be too weak for firebase rules or other creation errors
          if ((createErr as any).code === 'auth/email-already-in-use') {
            setError('Incorrect tournament password.');
          } else {
            setError((createErr as any).message || 'Failed to create account.');
          }
        }
      } else if (errorCode === 'auth/wrong-password') {
        setError('Incorrect tournament password.');
      } else {
        setError((err as any).message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Error signing out: ", err);
    }
  };

  if (auth.currentUser) {
    return (
      <button
        onClick={handleSignOut}
        className="group flex items-center space-x-3 bg-red-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-red-500 hover:scale-105 transition-all duration-300"
      >
        Sign Out
      </button>
    );
  }

  return (
    <form onSubmit={handleAuthAction} className="w-full max-w-xs animate-in zoom-in duration-300">
      <div className="relative group mb-2">
        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-300 group-focus-within:text-yellow-400 transition-colors" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter Email"
          required
          className="w-full pl-10 pr-4 py-3 rounded-t-lg bg-green-950/80 border-b-2 border-green-600 text-white placeholder-green-400/50 focus:outline-none focus:bg-green-900/90 focus:border-yellow-400 transition-all text-center tracking-widest backdrop-blur-sm"
        />
      </div>
      <div className="relative group">
        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-300 group-focus-within:text-yellow-400 transition-colors" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tournament Password"
          required
          className="w-full pl-10 pr-4 py-3 bg-green-950/80 border-b-2 border-green-600 text-white placeholder-green-400/50 focus:outline-none focus:bg-green-900/90 focus:border-yellow-400 transition-all text-center tracking-widest backdrop-blur-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-400 text-green-900 font-bold py-3 rounded-b-lg hover:bg-yellow-300 transition-colors shadow-lg uppercase tracking-wider text-sm mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Entering...' : 'Enter Tournament'}
        <ArrowRight className="h-5 w-5 inline-block ml-2" />
      </button>

      {error && (
        <div className="mt-4 bg-red-900/80 text-red-200 text-sm py-2 px-4 rounded border border-red-800/50 animate-pulse backdrop-blur-sm">
          {error}
        </div>
      )}
    </form>
  );
};

export default SignIn;
