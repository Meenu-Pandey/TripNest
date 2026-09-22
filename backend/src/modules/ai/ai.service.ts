import { env } from '@/config/env';
import { OllamaProvider } from '@/providers/ai/ollamaProvider';
import { OpenRouterProvider } from '@/providers/ai/openRouterProvider';
import type { IOllamaProvider } from '@/providers/ai/ollamaProvider.interface';
import { buildTripAiContext } from './ai.context';
import type { AiAction, AiRequestInput } from './ai.schemas';

export interface ProposedItineraryStop {
  time: string;
  title: string;
  placeId: string | null;
  placeName: string | null;
}

export type AiAvailabilityStatus = 'READY' | 'OLLAMA_UNAVAILABLE' | 'MODEL_UNAVAILABLE';

export interface AiStatusResult {
  available: boolean;
  status: AiAvailabilityStatus;
  defaultModel: string;
  models: string[];
  message: string;
}

export interface AiServiceResult {
  available: boolean;
  status?: AiAvailabilityStatus;
  action?: AiAction;
  reply?: string;
  model?: string;
  planStops?: ProposedItineraryStop[];
  reason?: string;
  message?: string;
}

function createDefaultAiProvider(): IOllamaProvider {
  if (env.AI_PROVIDER === 'openrouter') {
    return new OpenRouterProvider();
  }
  return new OllamaProvider();
}

export class AiService {
  constructor(private readonly provider: IOllamaProvider = createDefaultAiProvider()) {}

  async getStatus(): Promise<AiStatusResult> {
    const health = await this.provider.checkHealth();

    if (!health.available) {
      return {
        available: false,
        status: 'OLLAMA_UNAVAILABLE',
        defaultModel: health.defaultModel,
        models: [],
        message: 'TripNest AI runs locally via Ollama. Please ensure Ollama is installed and running.',
      };
    }

    if (!health.defaultModelAvailable) {
      return {
        available: false,
        status: 'MODEL_UNAVAILABLE',
        defaultModel: health.defaultModel,
        models: health.models,
        message: `AI provider is active, but model '${health.defaultModel}' is not yet downloaded. Run \`ollama pull ${health.defaultModel}\`.`,
      };
    }

    return {
      available: true,
      status: 'READY',
      defaultModel: health.defaultModel,
      models: health.models,
      message: `TripNest AI is ready using model '${health.defaultModel}'.`,
    };
  }

  async handleTripAiRequest(
    tripId: string,
    requesterId: string,
    input: AiRequestInput,
  ): Promise<AiServiceResult> {
    // 1. Gather sanitized trip context (enforces membership, IDOR protection, and date range)
    const { context, formattedContext } = await buildTripAiContext(tripId, requesterId, input.date);

    // 2. Check AI provider availability and model status (graceful fallback)
    const status = await this.getStatus();
    if (!status.available) {
      return {
        available: false,
        status: status.status,
        reason: status.status,
        message: status.message,
      };
    }

    // 3. Assemble action-specific prompt (Amendment 2: restrict chat strictly to current trip)
    const { systemPrompt, userPrompt } = this.buildPrompts(input, formattedContext);

    // 4. Generate completion via AI provider
    try {
      const completion = await this.provider.generateCompletion(systemPrompt, userPrompt);
      const reply = completion.response.trim();

      // For plan_day, strictly extract and validate proposed stops (Amendment 4)
      let planStops: ProposedItineraryStop[] | undefined;
      if (input.action === 'plan_day') {
        planStops = this.extractAndValidatePlanStops(reply, context.places);
      }

      return {
        available: true,
        status: 'READY',
        action: input.action,
        reply,
        model: status.defaultModel,
        planStops,
      };
    } catch (err) {
      return {
        available: false,
        status: 'OLLAMA_UNAVAILABLE',
        reason: 'AI_ERROR',
        message:
          err instanceof Error
            ? `AI service encountered an issue: ${err.message}`
            : 'AI service is temporarily unavailable.',
      };
    }
  }

  private buildPrompts(input: AiRequestInput, formattedContext: string) {
    const baseSystem = `You are TripNest AI, an expert collaborative travel assistant dedicated strictly to this specific trip.
GUIDELINES:
- Restrict all answers, analysis, and recommendations strictly to this trip and its destination.
- You must ONLY use the [VERIFIED DATA] provided in the context below.
- If data is marked as [UNAVAILABLE DATA], explicitly state that it is unavailable and DO NOT invent or hallucinate it.
- NEVER invent, infer, or hallucinate factual data. For weather, geocoding, ratings, distances, or opening hours, you MUST strictly rely ONLY on the provided context.
- If providing weather recommendations, explicitly state that you are basing it on the provided weather forecast.
- Keep responses well-formatted with clear markdown headings and bullet points. Break your response into logical sections (e.g., ### Trip Summary, ### Suggestions).
- Never output passwords, auth tokens, or private credentials.`;

    let actionInstruction = '';
    switch (input.action) {
      case 'plan_day':
        actionInstruction = `TASK: Plan a balanced, realistic, step-by-step daily itinerary for ${
          input.date ? `date: ${input.date}` : 'a designated day of this trip'
        }.
- Schedule appropriate start times, morning activity, lunch, afternoon activity, and evening.
- Order stops logically so places in the same vicinity are visited together.
- State clearly why the proposed schedule and ordering makes sense.
- Use a clear format for stops, for example:
  09:00 - Morning Breakfast
  11:00 - Visit [Place Name]
  13:30 - Lunch Break
  15:00 - Explore [Place Name]
  18:30 - Sunset & Dinner`;
        break;

      case 'improve_itinerary':
        actionInstruction = `TASK: Analyze the current itinerary for potential improvements.
- Identify inefficient stop sequences, awkward backtracking, overlapping times, excessive downtime, or missing meal/rest opportunities.
- Suggest constructive adjustments to optimize the travelers' time.`;
        break;

      case 'trip_summary':
        actionInstruction = `TASK: Provide a concise, factual executive summary of this trip based on the context.
- Include trip duration, number of travelers, saved places count, scheduled stops count, budget vs logged expenses, and highlight any recommended places not yet scheduled.
- Do not invent facts not in the context.`;
        break;

      case 'find_gaps':
        actionInstruction = `TASK: Identify planning gaps and oversights in this trip.
- Check for days with no itinerary items, saved places that were never scheduled, budget categories with high spend vs planned budget, or days overloaded with too many activities.
- Point out missing details clearly.`;
        break;

      case 'chat':
      default:
        actionInstruction = `TASK: Answer the traveler's question accurately using the supplied trip context. Politely redirect any off-topic queries back to planning this trip.`;
        break;
    }

    const systemPrompt = `${baseSystem}\n\n${actionInstruction}`;
    const userPrompt = `TRIP CONTEXT:\n${formattedContext}\n\n${
      input.prompt
        ? `USER QUESTION / INSTRUCTION:\n${input.prompt}`
        : `Please proceed with the ${input.action} task for this trip.`
    }`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Strictly extracts and validates candidate stops from AI output (Amendment 4).
   * Validates:
   * - Time format: HH:mm (24h)
   * - Title length between 2 and 200 chars
   * - placeId strictly mapped to an existing Place on this trip; otherwise null
   * - Drops any malformed or invalid proposals so they never reach mutations
   */
  private extractAndValidatePlanStops(
    text: string,
    validPlaces: { id: string; name: string }[],
  ): ProposedItineraryStop[] {
    const stops: ProposedItineraryStop[] = [];
    const lines = text.split('\n');
    const timePattern = /(?:^|\s|\*|-)(\d{1,2}:\d{2})\s*(?:[-–:]|\s)\s*(.+)$/;

    // Build lookup set of valid place IDs for this trip
    const validPlaceIds = new Set(validPlaces.map((p) => p.id));

    for (const rawLine of lines) {
      const line = rawLine.replace(/^\s*[-*#]+\s*/, '').trim();
      const match = line.match(timePattern);
      if (match) {
        let time = match[1]!;
        // Normalize time to HH:mm
        if (time.length === 4 && time.indexOf(':') === 1) {
          time = `0${time}`;
        }
        const [hh, mm] = time.split(':').map(Number);
        if (hh === undefined || mm === undefined || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
          continue; // skip invalid time
        }

        let title = match[2]!.trim().replace(/\*+/g, '');
        title = title.replace(/[.,;:]$/, '').trim();

        if (title.length < 2 || title.length > 200) {
          continue; // skip out-of-bounds titles
        }

        // Attempt place match strictly against valid places on this trip
        let matchedPlaceId: string | null = null;
        let matchedPlaceName: string | null = null;
        for (const p of validPlaces) {
          if (title.toLowerCase().includes(p.name.toLowerCase())) {
            matchedPlaceId = p.id;
            matchedPlaceName = p.name;
            break;
          }
        }

        // Validate placeId
        if (matchedPlaceId && !validPlaceIds.has(matchedPlaceId)) {
          matchedPlaceId = null;
          matchedPlaceName = null;
        }

        stops.push({
          time,
          title,
          placeId: matchedPlaceId,
          placeName: matchedPlaceName,
        });
      }
    }

    return stops.slice(0, 10);
  }
}

export const aiService = new AiService();
