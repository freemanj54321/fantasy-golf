
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Users, Calendar, Settings, List, Shield, Globe, Menu, X, ChevronDown, LogOut, User as UserIcon, Star } from 'lucide-react';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { useYear } from '../contexts/YearContext';
import { AppView, LeagueSettings } from '../types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly: boolean;
  children?: NavItem[];
}

interface HeaderProps {
  settings: LeagueSettings;
  isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ settings, isAdmin }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { year, setYear, availableYears } = useYear();

  const navRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const navItems: NavItem[] = [
    {
      path: '/league',
      label: 'League',
      icon: Trophy,
      adminOnly: false,
      children: [
        { path: '/', label: 'Leaderboard', icon: Trophy, adminOnly: false },
        { path: '/draft', label: 'Draft', icon: Users, adminOnly: false },
        { path: '/teams', label: 'Teams', icon: Shield, adminOnly: false },
      ],
    },
    {
      path: '/masters',
      label: 'Masters',
      icon: List,
      adminOnly: false,
      children: [
        { path: '/masters', label: 'The Masters', icon: List, adminOnly: false },
        { path: '/masters/current', label: 'Current Tournament', icon: Calendar, adminOnly: true },
      ],
    },
    { path: '/rankings', label: 'Rankings', icon: Globe, adminOnly: false },
    { path: '/champions', label: 'Champions Locker Room', icon: Star, adminOnly: false },
    {
      path: '/admin',
      label: 'Admin',
      icon: Settings,
      adminOnly: true,
      children: [
        { path: '/admin', label: 'Dashboard', icon: Settings, adminOnly: true },
        { path: '/admin/roles', label: 'Role Management', icon: Shield, adminOnly: true },
        { path: '/admin/autosync', label: 'Auto-Sync', icon: Settings, adminOnly: true },
      ],
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideDesktopNav = navRef.current?.contains(target);
      const isInsideMobileNav = mobileNavRef.current?.contains(target);

      if (!isInsideDesktopNav && !isInsideMobileNav) {
        setOpenDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/sign-in');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleLinkClick = () => {
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
  };

  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const isPathActive = (targetPath: string, currentPath: string) => {
    if (targetPath === '/') return currentPath === '/';
    return currentPath.startsWith(targetPath);
  };

  const renderNavItem = (item: NavItem) => {
    const isParentActive = item.children ? item.children.some(child => isPathActive(child.path, location.pathname)) : false;
    const isActive = isPathActive(item.path, location.pathname);
    const isDropdownOpen = openDropdown === item.path;

    if (item.children) {
      return (
        <div key={item.path} className="relative">
          <button
            onClick={() => setOpenDropdown(isDropdownOpen ? null : item.path)}
            className={`${isParentActive ? 'text-yellow-400' : 'text-gray-300 hover:text-white'} px-2 py-2 text-sm font-medium transition-colors flex items-center cursor-pointer`}
          >
            <item.icon className="h-4 w-4 mr-1.5" />
            {item.label}
            <ChevronDown className={`h-4 w-4 ml-1 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
              {item.children.filter(child => !child.adminOnly || isAdmin).map(child => (
                <Link
                  key={child.path}
                  to={child.path}
                  onClick={handleLinkClick}
                  className={`${isPathActive(child.path, location.pathname) ? 'bg-gray-100 text-green-900 font-medium' : 'text-gray-700 hover:bg-gray-100'} block px-4 py-2 text-sm flex items-center`}
                >
                  <child.icon className="h-4 w-4 mr-2 text-gray-500" />
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={handleLinkClick}
        className={`${isActive ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-300 hover:text-white'} px-2 py-2 text-sm font-medium transition-colors flex items-center`}
      >
        <item.icon className="h-4 w-4 mr-1.5" />
        {item.label}
      </Link>
    );
  }

  return (
    <header className="App-header sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo Area */}
          <Link to="/" className="flex items-center cursor-pointer">
            {settings.tournamentLogoUrl ? (
              <img src={settings.tournamentLogoUrl} alt="Logo" className="h-12 w-12 rounded-full mr-3 object-cover border-2 border-yellow-400" />
            ) : (
              <div className="bg-yellow-400 p-2 rounded-full mr-3">
                <Trophy className="h-6 w-6 text-green-900" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-wide masters-yellow">FANTASY GOLF</h1>
              <p className="text-xs uppercase tracking-widest text-gray-300">League</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center" ref={navRef}>
            {visibleNavItems.map(item => renderNavItem(item))}
          </nav>

          {/* Right side items for Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Year Selector */}
            <div className="flex items-center space-x-2 bg-green-900 px-3 py-1 rounded border border-green-700">
              <Calendar className="h-4 w-4 text-yellow-400" />
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="text-black">{y}</option>
                ))}
              </select>
            </div>

            {/* User Menu */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center space-x-2 p-1 rounded-full hover:bg-green-900">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random&color=fff`} alt="User" className="h-8 w-8 rounded-full border-2 border-yellow-400" />
                  <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 text-gray-800">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="font-semibold text-sm truncate">{user.displayName || 'Golf User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                    >
                      <UserIcon className="h-4 w-4 mr-2 text-gray-500" />
                      My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-2 text-gray-500" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/sign-in" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                <UserIcon className="h-4 w-4 mr-1.5" />
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white hover:text-yellow-400 focus:outline-none">
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div ref={mobileNavRef} className="md:hidden bg-green-800 absolute top-20 left-0 w-full shadow-lg max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-green-700">
          <nav className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {visibleNavItems.map(item => {
              if (item.children) {
                const isDropdownOpen = openDropdown === item.path;
                const isParentActive = item.children.some(child => isPathActive(child.path, location.pathname));
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : item.path)}
                      className={`${isParentActive ? 'bg-green-900 text-yellow-400' : 'text-gray-300 hover:bg-green-700 hover:text-white'} w-full text-left block px-3 py-2 rounded-md text-base font-medium flex items-center`}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.label}
                      <ChevronDown className={`h-5 w-5 ml-auto transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isDropdownOpen && (
                      <div className="pl-8 pr-2 pt-1 pb-1 space-y-1">
                        {item.children.filter(child => !child.adminOnly || isAdmin).map(child => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={handleLinkClick}
                            className={`${isPathActive(child.path, location.pathname) ? 'bg-green-900 text-yellow-400' : 'text-gray-300 hover:bg-green-700 hover:text-white'} w-full text-left block pl-3 pr-3 py-2 rounded-md text-base font-medium flex items-center`}
                          >
                            <child.icon className="h-5 w-5 mr-3" />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={`${isPathActive(item.path, location.pathname) ? 'bg-green-900 text-yellow-400' : 'text-gray-300 hover:bg-green-700 hover:text-white'} w-full text-left block px-3 py-2 rounded-md text-base font-medium flex items-center`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="px-5 py-3 border-t border-green-700">
            {/* Year Selector in Mobile Menu */}
            <div className="flex items-center space-x-2 bg-green-900 px-3 py-2 rounded-md border border-green-700 mb-2">
              <Calendar className="h-5 w-5 text-yellow-400" />
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-white text-base font-medium focus:outline-none w-full cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="text-black">{y}</option>
                ))}
              </select>
            </div>

            {/* User Info and Logout in Mobile Menu */}
            {user ? (
              <div >
                <div className="flex items-center p-2 mb-2">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random&color=fff`} alt="User" className="h-10 w-10 rounded-full border-2 border-yellow-400" />
                  <div className="ml-3">
                    <p className="text-base font-medium text-white truncate">{user.displayName || 'Golf User'}</p>
                    <p className="text-sm font-medium text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <Link
                  to="/profile"
                  onClick={handleLinkClick}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-green-700 hover:text-white flex items-center"
                >
                  <UserIcon className="h-5 w-5 mr-3" />
                  My Profile
                </Link>
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-green-700 hover:text-white flex items-center"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/sign-in"
                onClick={handleLinkClick}
                className={'text-gray-300 hover:bg-green-700 hover:text-white w-full text-left block px-3 py-2 rounded-md text-base font-medium flex items-center'}
              >
                <UserIcon className="h-5 w-5 mr-3" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
