/* Design DebitManager : rafraîchissement discret, fiable et sans perturber les formulaires des espaces métier. */
import { useEffect, useRef } from "react";

export function useLiveRefresh(refresh: () => void | Promise<void>, intervalMs = 15000) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled && document.visibilityState === "visible") void refreshRef.current();
    };
    const timer = window.setInterval(run, intervalMs);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intervalMs]);
}

export default useLiveRefresh;

/* Does this choice reinforce or dilute our dashboard refresh philosophy? It reinforces it by updating data quietly without reloading the page or interrupting input. */
