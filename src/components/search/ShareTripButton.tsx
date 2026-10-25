import { useRef, useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import type { Trip } from "../../types";
export function ShareTripButton({ trip, search = "" }: { trip: Trip; search?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    typeof window === "undefined" ? "" : window.location.hostname,
  );
  const visibleLabel = status === "copied" ? "Link copied" : local ? "Copy preview link" : "Share route";

  async function share() {
    const link = new URL(
      `/journey/${encodeURIComponent(trip.id)}${search}`,
      window.location.origin,
    ).href;
    setUrl(link);
    // Repeated copies must update the status region again, not silently reuse it.
    setStatus("idle");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return (
    <div className="share-trip">
      <button
        ref={buttonRef}
        className="share-trip-button"
        type="button"
        onClick={share}
        aria-label={`${visibleLabel} for ${trip.label ?? trip.id}`}
      >
        {status === "copied" ? <Check size={14} /> : <Share2 size={14} />}
        {visibleLabel}
      </button>
      {status !== "idle" && (
        <div className="share-feedback" role="status">
          <button
            className="share-dismiss"
            type="button"
            onClick={() => {
              setStatus("idle");
              buttonRef.current?.focus();
            }}
            aria-label="Dismiss link message"
          >
            <X size={14} />
          </button>
          <span>
            {status === "copied"
              ? "Journey link copied."
              : "Select and copy your journey link below."}
            {local &&
              " This preview URL works only on this computer. Deploy the app before sharing with friends."}
          </span>
          {status === "manual" && (
            <label>
              <Copy size={13} />
              <span className="sr-only">Journey link</span>
              <input
                aria-label="Journey link"
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
