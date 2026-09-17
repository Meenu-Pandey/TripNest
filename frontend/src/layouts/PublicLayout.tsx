import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/utils';

export function PublicLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  const [scrolled, setScrolled] = useState(!isLandingPage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDarkBg = (!scrolled && isLandingPage) || (!scrolled && isAuthPage);

  useEffect(() => {
    if (!isLandingPage) {
      Promise.resolve().then(() => setScrolled(true));
      return;
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLandingPage]);

  // Close mobile menu on route change
  useEffect(() => {
    Promise.resolve().then(() => setMobileMenuOpen(false));
  }, [location.pathname]);

  // Navbar now strictly minimal (Logo + Auth) as per final requirements
  return (
    <div className={cn(
      "flex min-h-screen flex-col text-sand-900 selection:bg-terracotta-100 selection:text-terracotta-900 overflow-x-hidden font-sans",
      isAuthPage ? "bg-terracotta-700" : "bg-sand-50"
    )}>
      {/* Header */}
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
          scrolled 
            ? "bg-sand-50/90 backdrop-blur-md border-b border-sand-200 py-2" 
            : "bg-transparent border-b-transparent py-4"
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 lg:px-12">
          {/* Left: Logo */}
          <Link to="/" className="shrink-0 flex items-center z-50">
            <Logo light={isDarkBg} />
          </Link>

          {/* Center: Removed completely for minimal editorial look */}
          {/* Right: Auth / CTA (Desktop) */}
          <div className="hidden md:flex items-center gap-4 z-50">
            {isAuthenticated ? (
              <Link to="/trips">
                <Button variant={isDarkBg ? "outline" : "primary"} className={cn(
                  "h-10 px-5 text-sm",
                  isDarkBg ? "bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md" : ""
                )}>
                  Go to Workspace
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className={cn(
                    "h-10 px-4 text-sm font-medium",
                    isDarkBg ? "text-white hover:bg-white/10" : "text-sand-700 hover:text-sand-900 hover:bg-sand-100/50"
                  )}>
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" className={cn(
                    "h-10 px-5 text-sm font-medium border-none",
                    isDarkBg 
                      ? "bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-glow" 
                      : "bg-terracotta-600 hover:bg-terracotta-700 text-white"
                  )}>
                    Get Started &rarr;
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden z-50 p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? (
              <X className={cn("w-6 h-6", isDarkBg ? "text-white" : "text-sand-900")} />
            ) : (
              <Menu className={cn("w-6 h-6", isDarkBg ? "text-white" : "text-sand-900")} />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <div className={cn(
          "absolute top-full left-0 right-0 bg-sand-50 border-b border-sand-200 shadow-xl overflow-hidden transition-all duration-300 ease-out md:hidden flex flex-col",
          mobileMenuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}>
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 pt-2">
              {isAuthenticated ? (
                <Link to="/trips" className="w-full">
                  <Button className="w-full" variant="primary">Go to Workspace</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="w-full">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link to="/register" className="w-full">
                    <Button variant="primary" className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      {isAuthPage ? (
        <footer className="py-6 border-t border-terracotta-600 text-center flex flex-col md:flex-row justify-center items-center gap-4 text-xs text-terracotta-200">
          <p>&copy; {new Date().getFullYear()} TripNest. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </footer>
      ) : (
        <footer className="bg-forest-950 text-sand-100 py-10 lg:py-12 border-t border-forest-900">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8">
              <div className="md:col-span-2 space-y-6">
                <Logo light={true} />
                <p className="max-w-xs text-sand-400 text-sm leading-relaxed">
                  The collaborative travel space designed to turn shared plans into shared memories.
                </p>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-4">Product</h4>
                <ul className="space-y-3 text-sm">
                  <li><a href="/#features" className="text-forest-200 hover:text-white transition-colors">Features</a></li>
                  <li><a href="/#how-it-works" className="text-forest-200 hover:text-white transition-colors">How It Works</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-4">Company</h4>
                <ul className="space-y-3 text-sm">
                  <li><a href="/#stories" className="text-forest-200 hover:text-white transition-colors">Stories</a></li>
                  <li><a href="/#about" className="text-forest-200 hover:text-white transition-colors">About</a></li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 pt-6 border-t border-forest-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-forest-300">
              <p>&copy; {new Date().getFullYear()} TripNest. All rights reserved.</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
