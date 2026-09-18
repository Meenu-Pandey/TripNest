import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/useAuth';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isTripWorkspace = location.pathname.match(/^\/trips\/[a-zA-Z0-9_-]+(\/|$)/) && !location.pathname.startsWith('/trips/new');
  
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    queryClient.clear();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 selection:bg-terracotta-100 selection:text-terracotta-900">
      {/* Top Navbar */}
      <header className={cn("sticky top-0 z-40 w-full border-b border-sand-200/90 bg-white/90 backdrop-blur-md", isTripWorkspace && "hidden md:block")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Main Nav */}
          <div className="flex items-center gap-8">
            <Link to="/trips">
              <Logo />
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              <NavLink
                to="/trips"
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500',
                    isActive
                      ? 'bg-terracotta-50 text-terracotta-900 font-semibold ring-1 ring-terracotta-200/80 shadow-xs'
                      : 'text-sand-600 hover:bg-sand-100/70 hover:text-sand-900',
                  )
                }
              >
                My Trips
              </NavLink>
              <NavLink
                to="/invitations"
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500',
                    isActive
                      ? 'bg-terracotta-50 text-terracotta-900 font-semibold ring-1 ring-terracotta-200/80 shadow-xs'
                      : 'text-sand-600 hover:bg-sand-100/70 hover:text-sand-900',
                  )
                }
              >
                Invitations
              </NavLink>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/trips/new" className="hidden sm:block">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New Trip
              </Button>
            </Link>

            {/* Notifications Button */}
            <NotificationBell />

            {/* User Profile Menu (Desktop) */}
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
                aria-expanded={userMenuOpen}
                aria-label="User menu"
              >
                <Avatar name={user?.name || 'User'} size="sm" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-sand-200 bg-white py-1.5 shadow-float z-50 animate-in fade-in zoom-in-95">
                  <div className="border-b border-sand-100 px-4 py-2.5">
                    <p className="text-sm font-medium text-sand-900 truncate">{user?.name}</p>
                    <p className="text-xs text-sand-500 truncate">{user?.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-sand-700 hover:bg-sand-50 hover:text-sand-900 transition-colors"
                  >
                    <UserIcon className="h-4 w-4 text-sand-400" />
                    Account Profile
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-sand-600 hover:bg-sand-100 transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              <div className="relative h-4 w-5">
                <span className={cn("absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform duration-300", mobileMenuOpen && "translate-y-1.5 rotate-45")} />
                <span className={cn("absolute left-0 top-1.5 h-0.5 w-5 bg-current transition-opacity duration-300", mobileMenuOpen && "opacity-0")} />
                <span className={cn("absolute left-0 top-3 h-0.5 w-5 bg-current transition-transform duration-300", mobileMenuOpen && "-translate-y-1.5 -rotate-45")} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu Sheet */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 top-[65px] h-[calc(100vh-65px)] bg-sand-50 border-t border-sand-200/90 z-50 animate-in slide-in-from-top-2 fade-in overflow-y-auto">
            <div className="flex flex-col px-4 py-6 gap-6">
              
              <div className="flex items-center gap-3 pb-6 border-b border-sand-200">
                <Avatar name={user?.name || 'User'} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-serif font-medium text-sand-900 truncate">{user?.name}</p>
                  <p className="text-sm text-sand-500 truncate">{user?.email}</p>
                </div>
              </div>
              
              <nav className="flex flex-col gap-2">
                <NavLink
                  to="/trips"
                  end
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors',
                      isActive
                        ? 'bg-terracotta-100 text-terracotta-900'
                        : 'text-sand-700 hover:bg-sand-100 hover:text-sand-900',
                    )
                  }
                >
                  My Trips
                </NavLink>
                <NavLink
                  to="/invitations"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors',
                      isActive
                        ? 'bg-terracotta-100 text-terracotta-900'
                        : 'text-sand-700 hover:bg-sand-100 hover:text-sand-900',
                    )
                  }
                >
                  Invitations
                </NavLink>
                <NavLink
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors',
                      isActive
                        ? 'bg-terracotta-100 text-terracotta-900'
                        : 'text-sand-700 hover:bg-sand-100 hover:text-sand-900',
                    )
                  }
                >
                  Account Profile
                </NavLink>
              </nav>

              <div className="pt-6 border-t border-sand-200 mt-auto">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* App Body */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
