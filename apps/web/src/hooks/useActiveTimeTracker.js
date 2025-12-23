import { useEffect, useRef } from "react";

export default function useActiveTimeTracker(userId) {
  const activeSeconds = useRef(0);
  const lastActivity = useRef(Date.now());
  const isActive = useRef(true);
  const idleTimeout = 10 * 1000; // 10 seconds

  useEffect(() => {
    if (!userId) return;

    const markActive = () => {
      lastActivity.current = Date.now();
      if (document.visibilityState === "visible") {
        isActive.current = true;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActive.current = false;
      } else {
        markActive();
      }
    };

    const idleChecker = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity.current > idleTimeout) {
        isActive.current = false;
      }
    }, 2000);

    const timeCounter = setInterval(() => {
      if (isActive.current && !document.hidden) {
        activeSeconds.current += 1;
      }
    }, 1000);

    const sendUsage = async () => {
      if (activeSeconds.current > 0) {
        const secondsToSend = activeSeconds.current;
        activeSeconds.current = 0;
        try {
          await fetch("/api/user-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, seconds: secondsToSend }),
          });
        } catch (e) {
          console.error("Failed to send usage:", e);
        }
      }
    };

    const sendInterval = setInterval(sendUsage, 60000);

    const handleBeforeUnload = () => {
      if (activeSeconds.current > 0) {
        try {
          const data = JSON.stringify({ userId, seconds: activeSeconds.current });
          const blob = new Blob([data], { type: "application/json" });
          navigator.sendBeacon("/api/user-activity", blob);
        } catch (err) {
          // ignore
        }
        activeSeconds.current = 0;
      }
    };

    document.addEventListener("mousemove", markActive);
    document.addEventListener("keydown", markActive);
    document.addEventListener("click", markActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("mousemove", markActive);
      document.removeEventListener("keydown", markActive);
      document.removeEventListener("click", markActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(idleChecker);
      clearInterval(timeCounter);
      clearInterval(sendInterval);
    };
  }, [userId]);
}

