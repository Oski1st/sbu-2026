import { useId, useRef, useState } from "react";
import type { ScheduledLeg } from "../../services/transit/timetables";
import { AMTRAK_BOOKING_URL, AMTRAK_HANDOFF_NOTE, amtrakTripText, copyTripText } from "../../lib/amtrakHandoff";

export function bookingFields(leg: ScheduledLeg) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: leg.from.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(leg.departure));
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return [
    {label: "From", value: leg.from.id},
    {label: "To", value: leg.to.id},
    {label: "Depart Date", value: `${part("month")}/${part("day")}/${part("year")}`},
    {label: "Departure time", value: `${part("hour")}:${part("minute")}`},
    {label: "Train number", value: leg.number},
  ];
}

export function BookingHandoff({leg}: {leg: ScheduledLeg}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const amtrak = leg.operator === "AMTRAK";
  const fields = bookingFields(leg);
  const tripText = amtrakTripText({from: leg.from.name, to: leg.to.name, departure: leg.departure, line: leg.route, train: leg.number});
  const tripField = useRef<HTMLInputElement>(null);
  const [handoff, setHandoff] = useState<"" | "copied" | "manual">("");
  async function openAmtrak() {
    window.open(AMTRAK_BOOKING_URL, "_blank", "noreferrer");
    setHandoff(await copyTripText(tripText, tripField.current) ? "copied" : "manual");
  }
  async function copy(value: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch {
      setStatus("Copy is unavailable. Select the text in a field and copy it manually.");
    }
  }
  return <section className="booking-handoff" aria-label={`${leg.operator} booking details`}>
    <p><strong>Exact ticket purchase links are not available.</strong> We cannot open or reserve this specific train for you. Confirm the current schedule, availability and fare with the operator.</p>
    {amtrak ? <>
      <p>On Amtrak, paste the station codes into <strong>From</strong> and <strong>To</strong>, select the matching station, then paste <strong>Depart Date</strong> (MM/DD/YYYY). Find the listed train number and departure time in the results. Copy each field separately; Amtrak does not accept the whole details block as one search.</p>
      <div className="booking-fields">
        {fields.map((field, index) => <div className="booking-field" key={field.label}>
          <label htmlFor={`${id}-${index}`}>{field.label}</label>
          <input id={`${id}-${index}`} readOnly value={field.value} onFocus={event => event.currentTarget.select()} />
          <button type="button" onClick={() => copy(field.value, field.label)} aria-label={`Copy Amtrak ${field.label}`}>Copy</button>
        </div>)}
      </div>
      <p>Departure time is local to {leg.from.timezone}. Use the train number and time to identify the departure after searching.</p>
      <button type="button" onClick={() => copy([...fields.map(f => `${f.label}: ${f.value}`), `Departure time zone: ${leg.from.timezone}`].join("\n"), "Booking details")}>Copy all booking details</button>
      <p>{AMTRAK_HANDOFF_NOTE}</p>
      <p><a href={AMTRAK_BOOKING_URL} target="_blank" rel="noreferrer" aria-label="Copy trip details and open Amtrak booking (opens in a new tab)" onClick={event => { event.preventDefault(); void openAmtrak(); }}>Copy trip details &amp; open Amtrak</a> — this link does not preselect a train.</p>
      <div className="booking-field" hidden={handoff !== "manual"}>
        <label htmlFor={`${id}-trip`}>Trip details (copy manually)</label>
        <input id={`${id}-trip`} ref={tripField} readOnly value={tripText} onFocus={event => event.currentTarget.select()} />
      </div>
      {handoff === "copied" && <p role="status">Trip details copied: {tripText}</p>}
      {handoff === "manual" && <p role="alert">Clipboard unavailable. Copy the trip details from the field above.</p>}
    </> : <>
      <p>LIRR tickets use station/zone pairs and fare rules, rather than a reserved seat on this particular train. In TrainTime, plan {leg.from.name} → {leg.to.name} for the departure shown above. Connecting LIRR legs may use one through ticket; check the complete journey before buying.</p>
      <p><a href="https://www.mta.info/traintime" target="_blank" rel="noreferrer">TrainTime purchase instructions</a> — not a prefilled ticket.</p>
    </>}
    <p role="status" aria-live="polite">{status}</p>
  </section>;
}
