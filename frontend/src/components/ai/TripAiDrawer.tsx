import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  X,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Compass,
  FileText,
  AlertCircle,
  MapPin,
  Clock,
  Send,
  Terminal,
  Info,
} from 'lucide-react';
import { useTripAi } from '@/context/TripAiContext';
import { aiService } from '@/services/ai.service';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ApplyItineraryStopModal } from './ApplyItineraryStopModal';
import type { Trip } from '@/types/trips';
import type { AiAction, ProposedItineraryStop, TripAiResponse } from '@/types/ai';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dates';

export interface TripAiDrawerProps {
  trip: Trip;
}

export function TripAiDrawer({ trip }: TripAiDrawerProps) {
  const {
    isOpen,
    closeDrawer,
    activeAction,
    setActiveAction,
    selectedDate,
    setSelectedDate,
    customPrompt,
    setCustomPrompt,
  } = useTripAi();

  const isViewer = trip.role === 'VIEWER';

  // 1. Ollama Health & Status Query
  const {
    data: aiStatus,
    isLoading: isCheckingStatus,
    isRefetching: isRefetchingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiService.getStatus(),
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const isAiReady = aiStatus?.status === 'READY';

  // Local state for interactive chat/generation
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [appliedStopMessage, setAppliedStopMessage] = useState<string | null>(null);
  const [selectedStopForModal, setSelectedStopForModal] = useState<ProposedItineraryStop | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<TripAiResponse | null>(null);

  // Generate list of dates within the trip range for easy selection
  const tripDates = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return [];
    const dates: string[] = [];
    const curr = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]!);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [trip.startDate, trip.endDate]);

  // Ensure selectedDate defaults to a valid trip date
  useEffect(() => {
    if (!selectedDate && tripDates.length > 0) {
      setSelectedDate(tripDates[0]!);
    }
  }, [selectedDate, tripDates, setSelectedDate]);

  // AI Generation Mutation
  const aiMutation = useMutation({
    mutationFn: async ({
      action,
      prompt,
      date,
    }: {
      action: AiAction;
      prompt?: string;
      date?: string;
    }) => {
      setAppliedStopMessage(null);
      return aiService.askTripAi(trip.id, {
        action,
        prompt: prompt?.trim() || undefined,
        date: action === 'plan_day' ? date : undefined,
      });
    },
    onSuccess: (data) => {
      setLastResponse(data);
      if (!data.available) {
        refetchStatus();
      }
    },
    onError: () => {
      refetchStatus();
    },
  });

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleActionSelect = (action: AiAction) => {
    setActiveAction(action);
  };

  const handleRunAi = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    aiMutation.mutate({
      action: activeAction,
      prompt: customPrompt,
      date: selectedDate || tripDates[0],
    });
  };

  const handleApplyStop = (stop: ProposedItineraryStop) => {
    setSelectedStopForModal(stop);
    setIsApplyModalOpen(true);
  };

  const handleStopAppliedSuccessfully = (title: string) => {
    setAppliedStopMessage(`Added "${title}" to your itinerary!`);
    setTimeout(() => setAppliedStopMessage(null), 5000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-sand-950/40 backdrop-blur-xs transition-opacity"
          onClick={closeDrawer}
          aria-hidden="true"
        />

        {/* Drawer Container (Slide-over desktop, bottom-sheet mobile) */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
          <div className="w-screen max-w-full sm:max-w-[480px] bg-white shadow-2xl flex flex-col h-full rounded-t-2xl sm:rounded-none overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="border-b border-sand-200 bg-sand-50/70 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-terracotta-100 text-terracotta-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-semibold text-sand-900">
                      TripNest AI
                    </h3>
                    <Badge
                      variant={
                        isAiReady
                          ? 'success'
                          : aiStatus?.status === 'MODEL_UNAVAILABLE'
                          ? 'warning'
                          : 'default'
                      }
                      className="text-[11px]"
                    >
                      {isCheckingStatus || isRefetchingStatus
                        ? 'Checking...'
                        : isAiReady
                        ? `Ready (${aiStatus?.defaultModel || 'llama3.2'})`
                        : aiStatus?.status === 'MODEL_UNAVAILABLE'
                        ? 'Model Missing'
                        : 'Ollama Offline'}
                    </Badge>
                  </div>
                  <p className="text-xs text-sand-500 truncate max-w-[240px] sm:max-w-xs">
                    {trip.destination ? `${trip.destination} • ` : ''}
                    {trip.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetchStatus()}
                  title="Check Ollama connection"
                  className="p-1.5 rounded-lg text-sand-500 hover:text-sand-900 hover:bg-sand-200/60 transition-colors"
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      (isCheckingStatus || isRefetchingStatus) && 'animate-spin',
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg text-sand-500 hover:text-sand-900 hover:bg-sand-200/60 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Ollama Offline / Setup Guide Card */}
              {!isAiReady && !isCheckingStatus && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Terminal className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-amber-900">
                        {aiStatus?.status === 'MODEL_UNAVAILABLE'
                          ? `Pull '${aiStatus?.defaultModel || 'llama3.2'}' to enable AI`
                          : 'Local Ollama Assistant Setup'}
                      </h4>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        TripNest AI runs 100% locally on your machine for complete privacy. All regular
                        TripNest features (itinerary, budget, places, map) remain fully operational.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-amber-900">
                      Run this in your terminal:
                    </p>
                    <div className="flex items-center justify-between rounded-xl bg-sand-950 p-2.5 font-mono text-xs text-sand-100">
                      <code>
                        {aiStatus?.status === 'MODEL_UNAVAILABLE'
                          ? `ollama pull ${aiStatus.defaultModel || 'llama3.2'}`
                          : 'ollama run llama3.2'}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyCommand(
                            aiStatus?.status === 'MODEL_UNAVAILABLE'
                              ? `ollama pull ${aiStatus.defaultModel || 'llama3.2'}`
                              : 'ollama run llama3.2',
                          )
                        }
                        className="ml-2 inline-flex items-center gap-1 rounded bg-sand-800 px-2 py-1 text-[11px] text-sand-200 hover:bg-sand-700 transition-colors"
                      >
                        {copiedCmd ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-amber-800">
                      Need Ollama? Get it free at{' '}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-medium hover:text-amber-950"
                      >
                        ollama.com
                      </a>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchStatus()}
                      disabled={isRefetchingStatus}
                      className="text-xs h-7 bg-white/80"
                    >
                      Check Connection
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Selector Chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
                  Planning Capability
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => handleActionSelect('plan_day')}
                    className={cn(
                      'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all',
                      activeAction === 'plan_day'
                        ? 'border-terracotta-500 bg-terracotta-50/80 text-terracotta-900 shadow-xs'
                        : 'border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50',
                    )}
                  >
                    <Calendar className="h-4 w-4 mb-1 text-terracotta-600" />
                    <span className="text-xs font-medium">Plan Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionSelect('improve_itinerary')}
                    className={cn(
                      'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all',
                      activeAction === 'improve_itinerary'
                        ? 'border-terracotta-500 bg-terracotta-50/80 text-terracotta-900 shadow-xs'
                        : 'border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50',
                    )}
                  >
                    <Compass className="h-4 w-4 mb-1 text-ocean-600" />
                    <span className="text-xs font-medium">Improve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionSelect('trip_summary')}
                    className={cn(
                      'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all',
                      activeAction === 'trip_summary'
                        ? 'border-terracotta-500 bg-terracotta-50/80 text-terracotta-900 shadow-xs'
                        : 'border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50',
                    )}
                  >
                    <FileText className="h-4 w-4 mb-1 text-forest-600" />
                    <span className="text-xs font-medium">Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleActionSelect('find_gaps')}
                    className={cn(
                      'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all',
                      activeAction === 'find_gaps'
                        ? 'border-terracotta-500 bg-terracotta-50/80 text-terracotta-900 shadow-xs'
                        : 'border-sand-200 bg-white text-sand-700 hover:border-sand-300 hover:bg-sand-50',
                    )}
                  >
                    <AlertCircle className="h-4 w-4 mb-1 text-amber-600" />
                    <span className="text-xs font-medium">Find Gaps</span>
                  </button>
                </div>
              </div>

              {/* Date Selector for 'plan_day' action */}
              {activeAction === 'plan_day' && (
                <div className="space-y-1.5 rounded-xl bg-sand-50 border border-sand-200/80 p-3">
                  <label className="block text-xs font-semibold text-sand-700 uppercase tracking-wider">
                    Select Target Day
                  </label>
                  {tripDates.length > 0 ? (
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20"
                    >
                      {tripDates.map((d, index) => (
                        <option key={d} value={d}>
                          Day {index + 1} — {formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-sand-500 italic">
                      Trip has no set start/end dates. Specify a date in your prompt.
                    </p>
                  )}
                </div>
              )}

              {/* Custom Prompt Input */}
              <form onSubmit={handleRunAi} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-sand-700 uppercase tracking-wider">
                      {activeAction === 'chat'
                        ? 'Your Question'
                        : 'Instructions or Preferences (Optional)'}
                    </label>
                    {activeAction !== 'chat' && (
                      <button
                        type="button"
                        onClick={() => setActiveAction('chat')}
                        className="text-[11px] text-terracotta-700 hover:underline"
                      >
                        Ask custom question
                      </button>
                    )}
                  </div>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      activeAction === 'plan_day'
                        ? 'e.g. Focus on cultural landmarks in the morning and relaxing dining in the evening...'
                        : activeAction === 'improve_itinerary'
                        ? 'e.g. Optimize for less transit time and good rest intervals...'
                        : activeAction === 'trip_summary'
                        ? 'e.g. Give an executive summary for our travel group...'
                        : activeAction === 'find_gaps'
                        ? 'e.g. Check if we forgot meals or transportation between cities...'
                        : 'Ask anything about this trip...'
                    }
                    rows={3}
                    className="w-full rounded-xl border border-sand-300 bg-sand-50/60 p-3 text-sm text-sand-900 focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-sand-500">
                    <Info className="h-3.5 w-3.5" />
                    <span>Private & offline via Ollama</span>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!isAiReady || aiMutation.isPending}
                    leftIcon={
                      aiMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )
                    }
                  >
                    {aiMutation.isPending ? 'Generating...' : 'Generate Plan'}
                  </Button>
                </div>
              </form>

              {/* Applied stop toast/banner */}
              {appliedStopMessage && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{appliedStopMessage}</span>
                </div>
              )}

              {/* Loading State Animation */}
              {aiMutation.isPending && (
                <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-5 space-y-3 animate-pulse">
                  <div className="flex items-center gap-2 text-terracotta-700 text-xs font-semibold">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>TripNest AI is synthesizing your trip itinerary...</span>
                  </div>
                  <div className="h-4 bg-sand-200 rounded w-5/6" />
                  <div className="h-4 bg-sand-200 rounded w-4/6" />
                  <div className="h-4 bg-sand-200 rounded w-3/4" />
                </div>
              )}

              {/* Error State */}
              {aiMutation.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-rose-900">
                    <AlertCircle className="h-4 w-4" />
                    <span>Generation Failed</span>
                  </div>
                  <p>
                    {aiMutation.error instanceof Error
                      ? aiMutation.error.message
                      : 'An error occurred while connecting to local AI.'}
                  </p>
                </div>
              )}

              {/* AI Response Display */}
              {lastResponse && !aiMutation.isPending && (
                <div className="space-y-4 pt-2">
                  {/* AI Unavailable State */}
                  {!lastResponse.available && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-amber-900 space-y-3">
                      <div className="font-semibold flex items-center gap-2 text-sm text-amber-950">
                        <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
                        <span>AI Assistant Unavailable</span>
                      </div>
                      <p className="leading-relaxed text-amber-800">
                        {lastResponse.message ||
                          'Local AI is temporarily unavailable. Please verify that Ollama is running.'}
                      </p>
                      <div className="pt-1 flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleRunAi()}
                          disabled={aiMutation.isPending}
                        >
                          Retry Request
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refetchStatus()}
                          disabled={isRefetchingStatus}
                        >
                          Check Connection
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Generated Text */}
                  {lastResponse.reply && (
                    <div className="flex gap-3 items-start p-1">
                      <div className="shrink-0 p-2 rounded-full bg-terracotta-100 text-terracotta-700 shadow-sm mt-1">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="flex-1 rounded-2xl rounded-tl-sm border border-sand-200 bg-white p-4 sm:p-5 shadow-sm space-y-3 relative">
                        <div className="flex items-center justify-between border-b border-sand-100 pb-2">
                          <span className="text-xs font-semibold text-sand-800">
                            Travel Assistant
                          </span>
                          {lastResponse.model && (
                            <span className="text-[10px] font-mono text-sand-400 bg-sand-100 px-1.5 py-0.5 rounded">
                              {lastResponse.model}
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-sand-800 whitespace-pre-wrap leading-relaxed prose prose-sm prose-sand max-w-none">
                          <ReactMarkdown
                            components={{
                              h1: ({ node, ...props }) => <h1 className="font-serif text-xl font-semibold text-sand-900 mt-6 mb-4 border-b border-sand-200 pb-2" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="font-serif text-lg font-semibold text-sand-900 mt-5 mb-3" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="font-serif text-base font-semibold text-terracotta-900 mt-4 mb-2 uppercase tracking-wider" {...props} />,
                              h4: ({ node, ...props }) => <h4 className="font-sans text-sm font-bold text-sand-900 mt-3 mb-1" {...props} />,
                              p: ({ node, ...props }) => <p className="mb-3 text-sand-800 leading-relaxed" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sand-800 marker:text-terracotta-500" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sand-800 marker:text-terracotta-700 font-semibold" {...props} />,
                              li: ({ node, ...props }) => <li className="pl-1 font-normal" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-bold text-sand-950" {...props} />,
                              em: ({ node, ...props }) => <em className="italic text-sand-700" {...props} />,
                              a: ({ node, ...props }) => <a className="text-ocean-600 underline hover:text-ocean-800" {...props} />,
                            }}
                          >
                            {lastResponse.reply}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proposed Itinerary Stops (Amendment 4 & 5: No Silent DB Mutations) */}
                  {lastResponse.planStops && lastResponse.planStops.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-sand-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-terracotta-600" />
                          <span>Proposed Schedule Stops ({lastResponse.planStops.length})</span>
                        </h4>
                        <span className="text-[11px] text-sand-500">
                          {selectedDate ? formatDate(selectedDate) : ''}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {lastResponse.planStops.map((stop, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-sand-200/90 border-l-4 border-l-terracotta-500 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sand-300 hover:shadow-soft transition-all"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-sand-100 border border-sand-200 px-2 py-0.5 rounded text-sand-800 font-semibold">
                                  <Clock className="h-3 w-3 text-terracotta-600" />
                                  {stop.time}
                                </span>
                                <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-terracotta-50 text-terracotta-700 border border-terracotta-200/60">
                                  AI Proposal
                                </span>
                                <span className="text-sm font-semibold text-sand-950">
                                  {stop.title}
                                </span>
                              </div>

                              {stop.placeName && (
                                <div className="flex items-center gap-1 text-[11px] text-terracotta-700 font-medium">
                                  <MapPin className="h-3 w-3 shrink-0 text-terracotta-600" />
                                  <span>Anchors saved place: {stop.placeName}</span>
                                </div>
                              )}
                            </div>

                            {!isViewer ? (
                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleApplyStop(stop)}
                                  className="text-xs bg-terracotta-600 hover:bg-terracotta-700 text-white"
                                  leftIcon={<Check className="h-3.5 w-3.5" />}
                                >
                                  Accept & Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setLastResponse((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            planStops: prev.planStops?.filter((_, i) => i !== index),
                                          }
                                        : null,
                                    );
                                  }}
                                  className="text-xs text-sand-600 hover:text-rose-700 hover:border-rose-200"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-sand-400 italic">
                                Viewers cannot edit
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Customize Modal for Applying Itinerary Stop (Amendment 5) */}
      {isApplyModalOpen && selectedStopForModal && (
        <ApplyItineraryStopModal
          key={`${selectedStopForModal.title}-${selectedStopForModal.time}`}
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          tripId={trip.id}
          stop={selectedStopForModal}
          targetDate={selectedDate || tripDates[0] || new Date().toISOString().split('T')[0]!}
          onSuccess={handleStopAppliedSuccessfully}
        />
      )}
    </>
  );
}
