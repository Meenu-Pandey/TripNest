# TRIPNEST — EXPLORE HTTP 304 / "PLACES UNAVAILABLE" INVESTIGATION REPORT

## Executive Summary

The Explore page displayed the error message **"Places are temporarily unavailable. Try again in a moment."** when `GET /api/v1/trips/:tripId/places` or `GET /api/v1/trips/:tripId/recommendations/discover` returned **HTTP 304 Not Modified**.

**Root Cause:**
1. Express has `etag: true` enabled by default. When the browser revalidated requests using `If-None-Match`, Express correctly responded with `HTTP 304 Not Modified` and an empty (0-byte) response body.
2. In the frontend `ApiClient` (`frontend/src/lib/apiClient.ts`), `response.json()` was invoked on all non-204 responses. When `304 Not Modified` was returned, `response.json()` threw a `SyntaxError: Unexpected end of JSON input` because HTTP 304 has no body.
3. The `catch` block in `ApiClient` checked `if (!response.ok)`. Since standard Fetch API specifies `response.ok` is `true` **only** for status codes 200–299 (and `false` for 304), `ApiClient` threw an `ApiClientError(304)`.
4. React Query caught this thrown error, marked `isError = true`, and `TripExplorePage.tsx` evaluated `isError || discoveryData?.available === false` as `true`, causing the UI to render **"Places are temporarily unavailable."**

---

## 1. Root Cause Breakdown & Investigation Findings

| Question | Investigation Finding |
| :--- | :--- |
| **1. Exact Frontend API Client Call** | `placesService.listPlaces(tripId)` and `recommendationsService.discoverNearby(tripId, ...)` invoke `apiClient.get(...)`. |
| **2. How Frontend Handled HTTP 304** | `apiClient` treated `304` as `!response.ok` (an error), failed to parse non-existent JSON body, and threw `ApiClientError(304)`. |
| **3. Browser Cache Presence** | Browser HTTP stack automatically sent `If-None-Match: W/"..."` on revalidation. |
| **4. JSON Parsing on 304** | `apiClient.ts` attempted `response.json()` on 304, causing `SyntaxError: Unexpected end of JSON input`. |
| **5. Response Headers** | `ETag: W/"..."` present; Express returned `304 Not Modified` when ETag matched `If-None-Match`. |
| **6. Cache Policy** | Dynamic API endpoints lacked explicit `Cache-Control: private, no-cache` headers, leading to unmanaged browser revalidation loops. |
| **7. Cause of UI Message** | Thrown 304 error set React Query `isError: true`, triggering the error banner in `TripExplorePage.tsx`. |

---

## 2. Exact Files Modified

1. **[`frontend/src/lib/apiClient.ts`](file:///e:/Projects/TripNest/frontend/src/lib/apiClient.ts)**
   - Added an in-memory GET response cache (`getCache = new Map<string, unknown>()`).
   - Handled `response.status === 304`: Returns the stored payload from `getCache` without attempting `response.json()` or throwing an error.
   - Clears/invalidates GET cache entries on mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).

2. **[`backend/src/app.ts`](file:///e:/Projects/TripNest/backend/src/app.ts)**
   - Added middleware for `/api/v1` routes: `res.setHeader('Cache-Control', 'private, no-cache')`.
   - Ensures API responses are marked user-private and browsers perform proper conditional revalidation without stale or public proxy caching.

3. **[`frontend/src/lib/apiClient.test.ts`](file:///e:/Projects/TripNest/frontend/src/lib/apiClient.test.ts)** [NEW]
   - Added comprehensive unit tests validating 304 Not Modified cache retrieval and cache invalidation on mutations.

---

## 3. Behavioral Comparison

| Scenario | Behavior BEFORE Fix | Behavior AFTER Fix |
| :--- | :--- | :--- |
| **First Request (200 OK)** | Parsed JSON & rendered places. | Parsed JSON, cached payload, & rendered places. |
| **Revalidation Request (304 Not Modified)** | `apiClient` threw `ApiClientError(304)` -> React Query `isError = true` -> UI showed **"Places are temporarily unavailable."** | `apiClient` retrieved cached payload -> React Query `isError = false` -> UI renders places & map pins seamlessly. |
| **Mutations (POST / DELETE place)** | N/A | `apiClient` invalidates GET cache -> Next request fetches fresh data from server. |

---

## 4. Verification & Automated Test Results

- **Frontend Unit Tests**: `32 passed (32 test files, 187 tests)` (including `apiClient.test.ts`) ✅
- **Frontend Typecheck**: `tsc -b --noEmit` passed with 0 errors ✅
- **Frontend Production Build**: `npm run build` completed successfully (`dist/assets/index-CvttZQ-g.js`) ✅
- **Backend Typecheck**: `tsc --noEmit` passed with 0 errors ✅
- **Backend Production Build**: `npm run build` completed successfully ✅
