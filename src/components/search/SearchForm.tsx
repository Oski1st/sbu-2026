import { useState, type FocusEvent } from "react";
import {
  ArrowRight,
  ArrowDownUp,
  CalendarDays,
  MapPin,
  Circle,
} from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { sampleLocationCatalogue, type LocationCatalogue } from "./locationCatalogue";

interface Props {
  initialOrigin?: string;
  initialDestination?: string;
  /** Planning preferences are persisted for sharing, but never rewrite sample itinerary times. */
  initialDepartureDate?: string;
  initialDepartureTime?: string;
  catalogue?: LocationCatalogue;
  timetable?: boolean;
  onDraftChange?: () => void;
  onDepartureCommit?: Props["onSearch"];
  onSearch: (
    origin: string,
    destination: string,
    preferences: { departureDate: string; departureTime: string },
  ) => void;
}
export function SearchForm({
  onSearch,
  initialOrigin = "Philadelphia",
  initialDestination = "Stony Brook",
  initialDepartureDate = "2026-10-24",
  initialDepartureTime = "08:00",
  catalogue = sampleLocationCatalogue,
  timetable = false,
  onDraftChange,
  onDepartureCommit,
}: Props) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate);
  const [departureTime, setDepartureTime] = useState(initialDepartureTime);
  function commitDeparture(event: FocusEvent<HTMLInputElement>) {
    if (!timetable || !onDepartureCommit || !event.currentTarget.form?.checkValidity()) return;
    const next = event.relatedTarget;
    if (next instanceof HTMLButtonElement && next.type === "submit") return;
    if (next instanceof Element && next.closest(".date-time-controls")) return;
    onDepartureCommit(origin, destination, {departureDate, departureTime});
  }
  return (
    <section className="search-section" aria-label="Plan your journey">
      <div className="search-heading">
        <span>
          <i />
          LET’S GET YOU THERE
        </span>
        <small>{timetable ? "One-way · Published timetables" : "One-way · Rail + intercity bus"}</small>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(origin, destination, { departureDate, departureTime });
        }}
        className="search-form"
      >
        <div className="location-field">
          <Circle size={17} />
          <LocationAutocomplete
            id="origin"
            name="origin"
            label="From"
            value={origin}
            onChange={(value) => {setOrigin(value); onDraftChange?.();}}
            required
            placeholder="Departure city"
            catalogue={catalogue}
            catalogueKind={timetable ? "transit" : "sample"}
          />
        </div>
        <button
          type="button"
          className="swap-button"
          aria-label="Swap origin and destination"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
            onDraftChange?.();
          }}
        >
          <ArrowDownUp size={17} />
        </button>
        <div className="location-field destination-field">
          <MapPin size={19} />
          <LocationAutocomplete
            id="destination"
            name="destination"
            label="To"
            value={destination}
            onChange={(value) => {setDestination(value); onDraftChange?.();}}
            required
            placeholder="Where to?"
            catalogue={catalogue}
            catalogueKind={timetable ? "transit" : "sample"}
          />
        </div>
        <div className="date-field">
          <CalendarDays size={19} />
          <div>
            <span>{timetable ? "DEPART AFTER · STATION LOCAL TIME" : "PLANNING PREFERENCE"}</span>
            <div className="date-time-controls">
              <label>
                Date
                <input
                  name="departure-date"
                  type="date"
                  value={departureDate}
                  onChange={(event) => {setDepartureDate(event.target.value); onDraftChange?.();}}
                  onBlur={commitDeparture}
                  required
                />
              </label>
              <label>
                Time
                <input
                  name="departure-time"
                  type="time"
                  value={departureTime}
                  onChange={(event) => {setDepartureTime(event.target.value); onDraftChange?.();}}
                  onBlur={commitDeparture}
                  required
                />
              </label>
            </div>
            <small>{timetable ? "Date and time are used to find published departures. Fares and live disruption data are not included." : "Saved in this share link. Sample itinerary times do not change."}</small>
          </div>
        </div>
        <button className="search-button" type="submit">
          Find my way <ArrowRight size={18} />
        </button>
      </form>
      <div className="search-footnote">
        <span>
          {timetable ? "Try Philadelphia, PA" : "Try our demo: Philadelphia"} <ArrowRight size={12} /> {timetable ? "Stony Brook, NY" : "Stony Brook"}
        </span>
        <span>{timetable ? "Manual entry stays available. Choose a city and state to disambiguate names." : "Sample plans · Date/time are planning preferences, not live schedules."}</span>
      </div>
    </section>
  );
}
