import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AMTRAK_BOOKING_URL, AMTRAK_HANDOFF_NOTE, amtrakTripText, copyTripText } from "../lib/amtrakHandoff";
import type { AmtrakTripDetails } from "../lib/amtrakHandoff";

interface AmtrakHandoffProps {
  details: AmtrakTripDetails;
  /** Non-expiring Amtrak page to open; defaults to the stable booking homepage. */
  href?: string;
  /** Text to copy; defaults to amtrakTripText(details). */
  copyText?: string;
  /** Visible note; defaults to the homepage handoff note. */
  note?: string;
  /** Visible label plus a screen-reader "(opens in a new tab)" span supplied by the call site. */
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * Click-time Amtrak handoff: the link opens a non-expiring Amtrak page in a new tab
 * (never a stored session URL) while the trip details are copied as a backup.
 */
export function AmtrakHandoff({ details, href = AMTRAK_BOOKING_URL, copyText, note = AMTRAK_HANDOFF_NOTE, children, className, "aria-label": ariaLabel }: AmtrakHandoffProps) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const text = copyText ?? amtrakTripText(details);
  return (
    <span className="amtrak-handoff">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        aria-label={ariaLabel}
        aria-describedby={`${id}-note`}
        data-amtrak-handoff=""
        onClick={() => {
          // No preventDefault: the native new-tab navigation keeps popup blockers out of the way.
          void copyTripText(text, field.current).then((copied) => setStatus(copied ? "copied" : "manual"));
        }}
      >
        {children}
      </a>
      <span id={`${id}-note`} className="amtrak-handoff-note">{note}</span>
      <label className={status === "manual" ? "amtrak-handoff-field" : "sr-only"}>
        <span className="sr-only">Trip details for Amtrak</span>
        <input
          ref={field}
          readOnly
          value={text}
          tabIndex={status === "manual" ? 0 : -1}
          aria-hidden={status === "manual" ? undefined : true}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <span role="status" aria-live="polite" className="amtrak-handoff-status">
        {status === "copied" ? "Copied" : status === "manual" ? "Trip details selected — press Ctrl+C (⌘C on Mac) to copy." : ""}
      </span>
    </span>
  );
}
