import type { PaginationMeta } from './api';

export type ActivityAction =
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_REMOVED'
  | 'PLACE_ADDED'
  | 'PLACE_UPDATED'
  | 'PLACE_REMOVED'
  | 'ITINERARY_ITEM_ADDED'
  | 'ITINERARY_ITEM_UPDATED'
  | 'ITINERARY_ITEM_REMOVED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'SETTLEMENT_SUGGESTED'
  | 'BUDGET_CATEGORY_ADDED'
  | 'BUDGET_CATEGORY_UPDATED'
  | 'BUDGET_CATEGORY_REMOVED'
  | 'MEMORY_ADDED'
  | 'TRIP_COMPLETED';

export interface ActivityDTO {
  id: string;
  action: ActivityAction | string;
  entityId: string | null;
  actor: {
    userId: string;
    name: string;
  } | null;
  metadata: unknown;
  createdAt: string;
}

export interface PaginatedActivity {
  activity: ActivityDTO[];
  pagination: PaginationMeta;
}
