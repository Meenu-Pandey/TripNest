import { Sparkles } from 'lucide-react';
import { useTripAi } from '@/context/TripAiContext';

export function TripAiFloatingButton() {
  const { openDrawer, isOpen } = useTripAi();

  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={() => openDrawer()}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-terracotta-600 to-terracotta-700 px-4 py-3 text-white shadow-float hover:from-terracotta-700 hover:to-terracotta-800 focus:outline-none focus:ring-4 focus:ring-terracotta-500/30 transition-all hover:scale-105 active:scale-95"
        aria-label="Open TripNest AI Assistant"
      >
        <Sparkles className="h-5 w-5 text-amber-200 transition-transform group-hover:rotate-12" />
        <span className="text-sm font-semibold tracking-wide pr-1">Trip AI</span>
      </button>
    </div>
  );
}
