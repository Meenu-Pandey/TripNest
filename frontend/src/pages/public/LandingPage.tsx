import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  MapPin, 
  Sparkles, 
  Users, 
  Compass, 
  CalendarDays, 
  Wallet,
  Camera,
  MessageSquare,
  Clock,
  Navigation,
  Map as MapIcon
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DestinationCover } from '@/components/ui/DestinationCover';
import { TripMap } from '@/components/map/TripMap';
import type { PlaceDTO } from '@/types/places';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';

// --- Scroll Reveal Helper ---
const Reveal = ({ 
  children, 
  className = '', 
  delay = 'delay-0',
  direction = 'up' 
}: { 
  children: React.ReactNode, 
  className?: string, 
  delay?: string,
  direction?: 'up' | 'left' | 'right' | 'down' | 'none'
}) => {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.15, triggerOnce: true });
  
  let translateClass = 'translate-y-8';
  if (direction === 'left') translateClass = '-translate-x-8';
  if (direction === 'right') translateClass = 'translate-x-8';
  if (direction === 'down') translateClass = '-translate-y-8';
  if (direction === 'none') translateClass = 'translate-y-0 translate-x-0';

  return (
    <div 
      ref={ref} 
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]', 
        isIntersecting ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${translateClass}`,
        delay,
        className
      )}
    >
      {children}
    </div>
  );
};

// --- Demo Data ---
const DEMO_PLACES: PlaceDTO[] = [
  {
    id: 'udaipur1',
    name: 'Taj Lake Palace',
    address: 'Udaipur, Rajasthan',
    latitude: 24.5756,
    longitude: 73.6795,
    category: 'Lodging',
    externalProvider: null,
    externalPlaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'udaipur2',
    name: 'City Palace',
    address: 'Udaipur, Rajasthan',
    latitude: 24.5764,
    longitude: 73.6835,
    category: 'Sightseeing',
    externalProvider: null,
    externalPlaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

import { useAuth } from '@/features/auth/useAuth';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const ctaLink = isAuthenticated ? '/trips' : '/register';
  
  return (
    <div className="flex flex-col bg-sand-50 text-sand-900 selection:bg-terracotta-100 selection:text-terracotta-900 overflow-x-hidden font-sans">
      
      {/* 1. HERO (Cinematic Storytelling) */}
      <section className="relative h-[620px] lg:h-[720px] w-full flex flex-col justify-end overflow-hidden pb-12 lg:pb-16 bg-sand-950 mt-[-64px]">
        <div className="absolute inset-0 z-0">
          <DestinationCover
            destination="Ladakh"
            title="Ladakh"
            category="Journey"
            className="w-full h-full !rounded-none scale-105 transform origin-center animate-[kenburns_20s_ease-out_forwards]"
            showTitle={false}
            showCategoryBadge={false}
            showDestination={false}
            aspectRatio="auto"
          />
          {/* Advanced Gradient Overlay for guaranteed text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/95 via-charcoal-950/50 to-charcoal-950/10" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end h-full pt-32">
          <Reveal delay="delay-100" className="lg:col-span-8 xl:col-span-7 space-y-6 lg:space-y-8 pb-4">
            <div className="inline-flex items-center gap-3 bg-charcoal-900/50 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-white/90 font-mono text-[11px] tracking-widest uppercase shadow-sm">
              <MapPin className="w-3 h-3 text-terracotta-500" />
              Leh, Ladakh
            </div>
            
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-[4.5rem] text-white leading-[1.05] tracking-tight drop-shadow-md">
              Your next journey<br />
              starts <span className="italic text-terracotta-400 font-light">together.</span>
            </h1>
            
            <p className="text-base sm:text-lg lg:text-xl text-sand-200 max-w-lg leading-relaxed font-light drop-shadow-sm">
              Plan trips together, organize places and itineraries, split expenses, and keep every memory in one shared space.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link to={ctaLink}>
                <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />} className="group w-full sm:w-auto h-12 px-8 text-base bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-glow border-none transition-all hover:shadow-lg hover:-translate-y-0.5">
                  Start Planning
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md transition-all">
                  See How It Works
                </Button>
              </a>
            </div>
          </Reveal>
          
          <Reveal direction="down" delay="delay-500" className="hidden lg:flex lg:col-span-4 xl:col-span-5 justify-end items-end pb-8">
            <div className="bg-charcoal-900/60 backdrop-blur-md border border-white/10 p-5 rounded-2xl shadow-float flex flex-col gap-3 max-w-[280px] w-full">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-white font-serif text-base">Himalayan Retreat</span>
                <span className="text-terracotta-400 font-mono text-[10px] tracking-wider border border-terracotta-400/30 px-2 py-0.5 rounded-full">OCT 14</span>
              </div>
              <div className="flex -space-x-2 pt-1">
                <div className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-ocean-500 text-white flex items-center justify-center text-xs font-medium">SJ</div>
                <div className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-amber-500 text-white flex items-center justify-center text-xs font-medium">MR</div>
                <div className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-forest-500 text-white flex items-center justify-center text-xs font-medium z-10 relative">
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-charcoal-900" />
                  AL
                </div>
              </div>
              <p className="text-sand-300 text-xs mt-1">3 travelers organizing right now</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2. FEATURE STRIP */}
      <section id="features" className="bg-sand-100 border-b border-sand-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 divide-x divide-sand-200/0 lg:divide-sand-200">
            {[
              { num: '01', icon: Users, title: 'Plan Together', desc: 'Invite and decide.' },
              { num: '02', icon: Compass, title: 'Discover', desc: 'Find hidden gems.' },
              { num: '03', icon: CalendarDays, title: 'Itinerary', desc: 'Chronological journey.' },
              { num: '04', icon: Wallet, title: 'Expenses', desc: 'Clear settlements.' },
              { num: '05', icon: Sparkles, title: 'AI Copilot', desc: 'Your private advisor.' },
              { num: '06', icon: Camera, title: 'Memories', desc: 'Keep every moment.' },
            ].map((feature, idx) => (
              <Reveal key={idx} delay={`delay-${idx * 100}`} className="px-2 lg:px-5 first:pl-0 flex flex-col group">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-terracotta-600/60 font-mono text-xs">{feature.num}</span>
                  <feature.icon className="w-4 h-4 text-sand-500 group-hover:text-terracotta-600 transition-colors" />
                </div>
                <h3 className="text-sand-950 font-serif text-lg mb-1">{feature.title}</h3>
                <p className="text-sand-600 text-xs">{feature.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PLAN TOGETHER */}
      <section id="how-it-works" className="py-16 lg:py-20 bg-sand-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <Reveal direction="right" className="lg:col-span-6 relative">
              <div className="h-[400px] lg:h-[480px] w-full rounded-3xl overflow-hidden shadow-card relative group mx-auto max-w-md lg:max-w-none">
                <DestinationCover destination="Kerala Backwaters" category="Culture" aspectRatio="auto" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" />
                
                {/* Visual Collaboration Elements */}
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                  <div className="self-end bg-white/95 backdrop-blur shadow-sm rounded-xl p-3 flex gap-2.5 items-center transform rotate-2 max-w-[200px]">
                    <div className="w-6 h-6 rounded-full bg-forest-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">ED</div>
                    <p className="text-xs text-sand-800 font-medium italic leading-snug">"Found a houseboat nearby!"</p>
                  </div>
                  
                  <div className="self-start bg-white/95 backdrop-blur shadow-sm rounded-xl p-3 flex gap-2.5 items-center transform -rotate-1 mt-auto max-w-[200px]">
                    <div className="w-6 h-6 rounded-full bg-ocean-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">MR</div>
                    <p className="text-xs text-sand-800 font-medium italic leading-snug">"Adding to our places."</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal direction="left" delay="delay-200" className="lg:col-span-6 space-y-6 lg:pl-10">
              <span className="inline-flex items-center gap-1.5 text-terracotta-600 font-mono text-[11px] tracking-wider uppercase bg-terracotta-100/50 px-2.5 py-1 rounded-full">
                <Users className="w-3.5 h-3.5" />
                Collaboration
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-sand-950 leading-[1.1] tracking-tight">
                Turn travel plans into shared decisions.
              </h2>
              <p className="text-sand-600 text-base leading-relaxed max-w-lg">
                Bring everyone onto the same page. Propose places, vote on activities, and watch your collective ideas merge into a seamless journey. End the chaos of scattered group chats and endless links.
              </p>
              <div className="pt-2">
                <Link to={ctaLink}>
                  <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />} className="h-12 px-6 text-sm">
                    Start a Shared Trip
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4. DISCOVER / MAP */}
      <section className="py-16 lg:py-20 bg-forest-950 text-sand-50 relative overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,rgba(255,255,255,1)_0%,transparent_100%)]" />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <Reveal className="order-2 lg:order-1 lg:col-span-5 space-y-6">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] tracking-wider uppercase bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-900">
                <Navigation className="w-3.5 h-3.5" />
                Discovery
              </span>
              <h2 className="font-serif text-4xl lg:text-5xl text-white leading-[1.1] tracking-tight">
                A spatial canvas for your journey.
              </h2>
              <p className="text-forest-200 text-base leading-relaxed max-w-md">
                Pin accommodations, map out sightseeing routes, and check local weather contexts without ever leaving the platform.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 max-w-md">
                <div className="bg-forest-900/50 p-4 rounded-xl border border-forest-800">
                  <MapIcon className="w-5 h-5 text-emerald-400 mb-2" />
                  <h4 className="text-white text-sm font-medium mb-1">Interactive Maps</h4>
                  <p className="text-xs text-forest-300">Smooth vector tiles and spatial pinning across the globe.</p>
                </div>
                <div className="bg-forest-900/50 p-4 rounded-xl border border-forest-800">
                  <Sparkles className="w-5 h-5 text-amber-400 mb-2" />
                  <h4 className="text-white text-sm font-medium mb-1">Live Open-Meteo</h4>
                  <p className="text-xs text-forest-300">Weather forecasts integrated directly into your spatial view.</p>
                </div>
              </div>
            </Reveal>

            <Reveal direction="right" delay="delay-200" className="order-1 lg:order-2 lg:col-span-7 relative h-[360px] lg:h-[480px] w-full rounded-3xl overflow-hidden shadow-float group">
              {/* Real MapLibre Interactive Preview */}
              <div className="absolute inset-0 pointer-events-none sm:pointer-events-auto">
                <TripMap 
                  places={DEMO_PLACES}
                  selectedPlaceId={null}
                  onSelectPlace={() => {}}
                />
              </div>
              
              {/* Overlay for contrast over the map controls and edges, and preventing scroll-trapping on mobile by disabling pointer events on the overlay itself */}
              <div className="absolute inset-0 ring-1 ring-inset ring-forest-800/30 rounded-3xl pointer-events-none" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5. ITINERARY */}
      <section className="py-16 lg:py-24 bg-cream-50 relative">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <Reveal className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 text-terracotta-600 font-mono text-[11px] tracking-wider uppercase bg-terracotta-100/50 px-2.5 py-1 rounded-full">
              <CalendarDays className="w-3.5 h-3.5" />
              Chronology
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl text-sand-950 leading-[1.1] tracking-tight">
              A journey, day by day.
            </h2>
            <p className="text-sand-600 text-base">
              Establish the rhythm of your trip. Layer your days with places, transit, and time to breathe.
            </p>
          </Reveal>

          <div className="relative mx-auto max-w-2xl">
            {/* The vertical travel route line */}
            <div className="absolute left-[39px] sm:left-[63px] top-4 bottom-4 w-px bg-terracotta-200" />
            
            <div className="space-y-12">
              {[
                { time: '09:00', label: 'Morning', title: 'Eravikulam National Park', desc: 'Early trek through the misty hills to spot the Nilgiri Tahr.', img: 'Eravikulam National Park' },
                { time: '13:00', label: 'Lunch', title: 'Munnar Tea Estates', desc: 'Winding walk through the lush green tea gardens with local tea tasting.', img: 'Munnar' },
              ].map((stop, idx) => (
                <Reveal key={idx} delay={`delay-${idx * 150}`} className="relative pl-24 sm:pl-32 flex flex-col sm:flex-row gap-6 group">
                  {/* Timeline Node */}
                  <div className="absolute left-[35px] sm:left-[59px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-cream-50 bg-terracotta-500 transition-transform duration-300 group-hover:scale-125 z-10" />
                  
                  <div className="absolute left-0 top-0.5 w-20 sm:w-24 text-right pr-6 sm:pr-8">
                    <p className="font-serif text-lg sm:text-xl text-terracotta-700">{stop.time}</p>
                    <p className="text-[9px] text-sand-500 uppercase tracking-widest font-mono mt-0.5">{stop.label}</p>
                  </div>

                  <div className="flex-1 space-y-2">
                    <h3 className="font-serif text-2xl text-sand-900">{stop.title}</h3>
                    <p className="text-sand-600 text-sm leading-relaxed">{stop.desc}</p>
                  </div>

                  <div className="w-full sm:w-48 shrink-0 rounded-2xl overflow-hidden shadow-sm aspect-video sm:aspect-square">
                    <DestinationCover destination={stop.img} category="Photo" aspectRatio="auto" showTitle={false} showCategoryBadge={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. EXPENSES */}
      <section className="py-16 lg:py-24 bg-terracotta-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-white/40 skew-x-12 translate-x-32" />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
          <Reveal className="space-y-6 order-2 lg:order-1">
            <span className="inline-flex items-center gap-1.5 text-terracotta-700 font-mono text-[11px] tracking-wider uppercase bg-terracotta-200/50 px-2.5 py-1 rounded-full border border-terracotta-200">
              <Wallet className="w-3.5 h-3.5" />
              Settlements
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl text-sand-950 leading-[1.1] tracking-tight">
              Travel together.<br/>Split fairly.
            </h2>
            <p className="text-sand-700 text-base leading-relaxed max-w-md">
              No awkward IOUs. Log expenses as they happen, split them equally or precisely, and let TripNest calculate the simplest way to settle up.
            </p>
          </Reveal>

          <Reveal direction="left" delay="delay-100" className="order-1 lg:order-2 bg-white rounded-3xl p-6 lg:p-8 shadow-card border border-terracotta-100 flex flex-col gap-8 max-w-md mx-auto w-full">
            <div className="flex justify-between items-end border-b border-sand-100 pb-4">
              <div>
                <p className="text-[10px] text-sand-500 font-mono tracking-widest uppercase mb-1">Simplification</p>
                <p className="font-serif text-2xl text-sand-900">Who owes who</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Visual Settlement Flow */}
              <div className="flex items-center gap-3 group">
                <div className="flex flex-col items-center gap-1.5 w-1/4">
                  <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-bold font-serif text-sm shadow-sm">AL</div>
                  <span className="font-medium text-sand-900 text-xs">Alice</span>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center relative">
                  <span className="text-xs font-mono text-terracotta-700 bg-terracotta-50 px-2 py-1 rounded-full mb-1 z-10 border border-terracotta-100 shadow-sm">
                    owes $120
                  </span>
                  <div className="w-full h-px bg-terracotta-200 absolute top-1/2 translate-y-2">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-terracotta-400 rotate-45" />
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-1.5 w-1/4">
                  <div className="w-10 h-10 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center font-bold font-serif text-sm shadow-sm">BO</div>
                  <span className="font-medium text-sand-900 text-xs">Bob</span>
                </div>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="flex flex-col items-center gap-1.5 w-1/4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold font-serif text-sm shadow-sm">CH</div>
                  <span className="font-medium text-sand-900 text-xs">Charlie</span>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center relative">
                  <span className="text-xs font-mono text-terracotta-700 bg-terracotta-50 px-2 py-1 rounded-full mb-1 z-10 border border-terracotta-100 shadow-sm">
                    owes $45
                  </span>
                  <div className="w-full h-px bg-terracotta-200 absolute top-1/2 translate-y-2">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-terracotta-400 rotate-45" />
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-1.5 w-1/4">
                  <div className="w-10 h-10 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center font-bold font-serif text-sm shadow-sm">BO</div>
                  <span className="font-medium text-sand-900 text-xs">Bob</span>
                </div>
              </div>
            </div>
            
            <div className="bg-sand-50 p-4 rounded-xl border border-sand-100 text-center mt-2">
              <p className="text-sand-600 text-xs font-medium">3 original expenses simplified into 2 clear payments.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 7. AI COPILOT */}
      <section className="py-16 lg:py-24 bg-charcoal-950 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_50%)]" />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
          <Reveal className="order-2 lg:order-1 relative max-w-md mx-auto w-full">
            <div className="bg-charcoal-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-float">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="bg-amber-400/10 p-1.5 rounded-lg">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="font-serif text-xl text-white">Trip AI Copilot</span>
                </div>
                <span className="text-[10px] font-mono bg-forest-950 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded-full">AI Powered</span>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white/5 rounded-xl p-4 text-sand-200 border border-white/5 relative shadow-inner">
                  <div className="absolute -left-2 top-4 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px] border-r-white/5" />
                  <p className="text-sm leading-relaxed font-serif italic">"Your morning in Jaipur is free. Consider visiting..."</p>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-0.5 shrink-0 bg-gradient-to-b from-terracotta-500 to-transparent rounded-full" />
                  <div className="space-y-3 w-full">
                    <div className="border border-terracotta-900/50 bg-terracotta-950/20 p-4 rounded-xl group transition-all hover:bg-terracotta-950/40 hover:border-terracotta-800">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock className="w-3 h-3 text-terracotta-400" />
                        <p className="font-mono text-xs text-terracotta-400 tracking-wider">09:00</p>
                      </div>
                      <h4 className="font-serif text-lg text-white mb-1.5">Amer Fort</h4>
                      <p className="text-sand-400 text-xs leading-relaxed mb-4">Explore the magnificent Rajput architecture before the crowds arrive.</p>
                      <Button size="sm" variant="outline" className="w-full h-8 border-terracotta-700/50 text-terracotta-300 bg-transparent hover:bg-terracotta-900/50 transition-colors text-xs">
                        Apply to Itinerary
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          
          <Reveal direction="left" delay="delay-100" className="order-1 lg:order-2 space-y-6 lg:pl-8">
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-mono text-[11px] tracking-wider uppercase bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-900/50">
              <MessageSquare className="w-3.5 h-3.5" />
              Intelligence
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl text-white leading-[1.1] tracking-tight">
              Your private<br />travel advisor.
            </h2>
            <p className="text-sand-300 text-base leading-relaxed max-w-md">
              AI-powered day planning generates tailored itinerary proposals and appends structured suggestions directly into your trip workspace.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 8. MEMORIES (Editorial Photo Collage) */}
      <section id="stories" className="py-16 lg:py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal className="text-center max-w-xl mx-auto mb-12 lg:mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 text-terracotta-600 font-mono text-[11px] tracking-wider uppercase bg-terracotta-50 px-2.5 py-1 rounded-full">
              <Camera className="w-3.5 h-3.5" />
              Memories
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl text-sand-950 leading-[1.1] tracking-tight">
              Preserve every moment.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[420px] lg:h-[500px]">
            {/* Large Anchor Image */}
            <Reveal className="md:col-span-7 h-full group rounded-3xl overflow-hidden shadow-card relative">
              <DestinationCover destination="Jaisalmer" category="Photo" aspectRatio="auto" showTitle={false} showCategoryBadge={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-charcoal-950/80 to-transparent p-6 pt-16">
                <p className="text-white font-serif text-2xl drop-shadow-md">Rajasthan</p>
                <p className="text-white/80 font-mono text-[10px] tracking-widest uppercase mt-1">October 2026</p>
              </div>
            </Reveal>
            
            {/* Offset Images */}
            <div className="md:col-span-5 flex flex-col gap-6 relative h-full">
              <Reveal delay="delay-100" className="flex-1 rounded-3xl overflow-hidden shadow-card relative group">
                <DestinationCover destination="Meghalaya" category="Photo" aspectRatio="auto" showTitle={false} showCategoryBadge={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white font-serif text-xl drop-shadow-md">Meghalaya</p>
                </div>
              </Reveal>
              
              <div className="flex-1 flex gap-6">
                <Reveal delay="delay-200" className="flex-1 rounded-3xl overflow-hidden shadow-card relative group">
                  <DestinationCover destination="Himachal Pradesh" category="Photo" aspectRatio="auto" showTitle={false} showCategoryBadge={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" />
                </Reveal>
                
                {/* Polaroid Stylized Photo */}
                <Reveal delay="delay-300" className="flex-1 bg-white p-2.5 pb-8 rounded-xl shadow-float transform rotate-3 hover:rotate-0 transition-transform duration-500 ease-out border border-sand-100">
                  <div className="w-full h-full rounded-lg overflow-hidden bg-sand-100 shadow-inner">
                    <DestinationCover destination="Goa" category="Photo" aspectRatio="auto" showTitle={false} showCategoryBadge={false} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-serif italic text-sand-800 text-center pt-2 text-sm">Goa</p>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA / ABOUT */}
      <section id="about" className="py-24 lg:py-32 bg-charcoal-950 text-white text-center relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute inset-0 z-0">
          <DestinationCover destination="Kashmir" category="Journey" aspectRatio="auto" showTitle={false} showCategoryBadge={false} showDestination={false} className="w-full h-full object-cover opacity-30 mix-blend-screen scale-105 transform animate-[kenburns_30s_ease-out_forwards]" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/70 to-charcoal-950/20" />
        </div>
        
        <Reveal className="relative z-10 max-w-3xl mx-auto px-6 space-y-8">
          <h2 className="font-serif text-5xl lg:text-6xl leading-[1.05] tracking-tight drop-shadow-lg">
            Go somewhere<br />together.
          </h2>
          <div className="pt-4">
            <Link to={ctaLink}>
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />} className="group h-14 px-10 text-lg bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-glow rounded-2xl border-none transition-all hover:scale-105">
                Start Planning
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
