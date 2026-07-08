---
name: Generated React Query hooks always pass a signal, silently disabling "no signal" fallback logic
description: Orval-generated queryFn always forwards React Query's own AbortSignal into the fetch client — any custom-fetch logic gated on "no signal was passed" is dead code in practice.
---

Orval's generated `queryFn` for every hook does `({ signal }) => getX({ signal, ...requestOptions })` — so a custom fetch wrapper's `init.signal` is **always** truthy when called through generated hooks, even though the app itself never explicitly passes a signal anywhere.

**Why this matters:** a common pattern is "if the caller supplied their own AbortSignal, respect it as-is; otherwise wrap the request in our own AbortController for a timeout." Because generated hooks always supply React Query's own cancel-on-unmount signal, the "otherwise" branch never runs — a per-request timeout implemented this way is silently unreachable, and a genuinely hung request (server accepts the TCP connection but never responds) will hang until React Query's/browser's own (very long or nonexistent) timeout instead of the intended shorter one.

**How to apply:** when adding a request timeout to a fetch client used by Orval-generated hooks, always create your own `AbortController`/timeout regardless of whether a caller signal is present, and combine the two with `AbortSignal.any([callerSignal, timeoutController.signal])` (with a manual two-listener fallback if `AbortSignal.any` isn't available in the target runtime) so either can cancel the request. Verify by killing/blackholing the backend (not just returning an error response) and confirming the timeout still fires within the configured window.
