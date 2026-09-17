/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AiAction } from '@/types/ai';

export interface OpenAiDrawerOptions {
  action?: AiAction;
  date?: string;
  prompt?: string;
}

export interface TripAiContextValue {
  isOpen: boolean;
  activeAction: AiAction;
  selectedDate: string;
  customPrompt: string;
  openDrawer: (options?: OpenAiDrawerOptions) => void;
  closeDrawer: () => void;
  setActiveAction: (action: AiAction) => void;
  setSelectedDate: (date: string) => void;
  setCustomPrompt: (prompt: string) => void;
}

const TripAiContext = createContext<TripAiContextValue | undefined>(undefined);

export function TripAiProvider({
  children,
  defaultDate = '',
}: {
  children: React.ReactNode;
  defaultDate?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<AiAction>('plan_day');
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const openDrawer = useCallback((options?: OpenAiDrawerOptions) => {
    if (options?.action) setActiveAction(options.action);
    if (options?.date) setSelectedDate(options.date);
    if (options?.prompt !== undefined) setCustomPrompt(options.prompt);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <TripAiContext.Provider
      value={{
        isOpen,
        activeAction,
        selectedDate,
        customPrompt,
        openDrawer,
        closeDrawer,
        setActiveAction,
        setSelectedDate,
        setCustomPrompt,
      }}
    >
      {children}
    </TripAiContext.Provider>
  );
}

const defaultTripAiContextValue: TripAiContextValue = {
  isOpen: false,
  activeAction: 'plan_day',
  selectedDate: '',
  customPrompt: '',
  openDrawer: () => {},
  closeDrawer: () => {},
  setActiveAction: () => {},
  setSelectedDate: () => {},
  setCustomPrompt: () => {},
};

export function useTripAi(): TripAiContextValue {
  const context = useContext(TripAiContext);
  return context ?? defaultTripAiContextValue;
}

