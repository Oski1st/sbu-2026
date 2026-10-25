import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowDownUp,
  CalendarDays,
  MapPin,
  Circle,
} from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { sampleLocationCatalogue, type LocationCatalogue } from "./locationCatalogue";
import {
  isPlanningDate,
  MAX_PLANNING_DATE as MAX_DATE,
  parsePlanningTime,
  todayInNewYork,
} from "../../data/searchState";
import { IconTooltip } from "../ui/icon-tooltip";
import {
  createPreferenceRefresh,
  validPreferences,
  type PlanningPreferences,
} from "./preferenceRefresh";

interface Props {
  initialOrigin?: string;
  initialDestination?: string;
  /** Planning preferences are persisted for sharing and shift the sample timeline as a demo preview only. */
  initialDepartureDate?: string;
  initialDepartureTime?: string;
  catalogue?: LocationCatalogue;
  onSearch: (
    origin: string,
    destination: string,
    preferences: PlanningPreferences,
  ) => void;
  /**
   * Re-runs the search when the Date or Time changes: a valid value is sent after
   * PREFERENCE_DEBOUNCE_MS (at once on blur); `null` at once while either is incomplete
   * or out of range, so the page can hide results that no longer match the form.
   * Enter and Search trips still submit through `onSearch`.
   */
  onPreferencesChange?: (preferences: PlanningPreferences | null) => void;
}
export function SearchForm({
  onSearch,
  onPreferencesChange,
  initialOrigin = "Philadelphia",
  initialDestination = "Stony Brook",
  initialDepartureDate = todayInNewYork(),
  initialDepartureTime = "08:00",
  catalogue = sampleLocationCatalogue,
}: Props) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate);
  const [departureTime, setDepartureTime] = useState(initialDepartureTime);
  // The preference the results already show: from the URL, or last sent by this form.
  const shown = useRef(`${initialDepartureDate}|${initialDepartureTime}`);
  const latestOnPreferencesChange = useRef(onPreferencesChange);
  useEffect(() => {
    latestOnPreferencesChange.current = onPreferencesChange;
  });
  const [refresh] = useState(() =>
    createPreferenceRefresh((preferences) => {
      if (preferences) shown.current = `${preferences.departureDate}|${preferences.departureTime}`;
      latestOnPreferencesChange.current?.(preferences);
    }),
  );
  useEffect(() => refresh.cancel, [refresh]);
  useEffect(() => {
    const incoming = `${initialDepartureDate}|${initialDepartureTime}`;
    if (incoming === shown.current) return;
    // Back/Forward or a shared link changed the preference: show it, not a stale draft.
    shown.current = incoming;
    refresh.cancel();
    setDepartureDate(initialDepartureDate);
    setDepartureTime(initialDepartureTime);
  }, [initialDepartureDate, initialDepartureTime, refresh]);
  function preferencesChanged(nextDate: string, nextTime: string) {
    if (onPreferencesChange) refresh.change(nextDate, nextTime);
  }
  const draftInvalid = onPreferencesChange !== undefined && !validPreferences(departureDate, departureTime);
  return (
    <section className="search-section" aria-label="Plan your journey">
      <div className="search-heading">
        <span>
          <i />
          PLAN A TRIP
        </span>
        <small>One-way · Rail + intercity bus</small>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          // Search trips (or Enter) runs the full search now; drop any waiting auto-refresh.
          refresh.cancel();
          const form = event.currentTarget;
          const dateInput = form.elements.namedItem("departure-date");
          const timeInput = form.elements.namedItem("departure-time");
          const today = todayInNewYork();
          // Chrome can roll a typed 5-digit year into e.g. 0270; never submit or share an out-of-range date.
          if (dateInput instanceof HTMLInputElement) {
            dateInput.setCustomValidity(
              isPlanningDate(departureDate, today)
                ? ""
                : `Choose a date from ${today} to ${MAX_DATE}.`,
            );
          }
          // Text-field fallbacks can hold a partial time such as "4:3".
          if (timeInput instanceof HTMLInputElement) {
            timeInput.setCustomValidity(
              !departureTime || parsePlanningTime(departureTime) ? "" : "Enter a complete time, such as 4:30 PM.",
            );
          }
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          onSearch(origin, destination, {
            departureDate,
            departureTime: parsePlanningTime(departureTime) ?? departureTime,
          });
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
            onChange={setOrigin}
            required
            placeholder="Departure city"
            catalogue={catalogue}
          />
        </div>
        <IconTooltip label="Swap origin and destination">
          <button
            type="button"
            className="swap-button"
            aria-label="Swap origin and destination"
            onClick={() => {
              setOrigin(destination);
              setDestination(origin);
            }}
          >
            <ArrowDownUp size={17} />
          </button>
        </IconTooltip>
        <div className="location-field destination-field">
          <MapPin size={19} />
          <LocationAutocomplete
            id="destination"
            name="destination"
            label="To"
            value={destination}
            onChange={setDestination}
            required
            placeholder="Arrival city"
            catalogue={catalogue}
          />
        </div>
        <div className="date-field">
          <CalendarDays size={19} />
          <div>
            <span>PLANNING PREFERENCE</span>
            <div className="date-time-controls">
              <label>
                Date
                <input
                  name="departure-date"
                  type="date"
                  value={departureDate}
                  onChange={(event) => {
                    event.target.setCustomValidity("");
                    setDepartureDate(event.target.value);
                    preferencesChanged(event.target.value, departureTime);
                  }}
                  onBlur={refresh.flush}
                  aria-invalid={draftInvalid && !isPlanningDate(departureDate) ? true : undefined}
                  min={todayInNewYork()}
                  max={MAX_DATE}
                  required
                />
              </label>
              <label>
                Time
                <input
                  name="departure-time"
                  type="time"
                  value={departureTime}
                  onChange={(event) => {
                    event.target.setCustomValidity("");
                    setDepartureTime(event.target.value);
                    preferencesChanged(departureDate, event.target.value);
                  }}
                  onBlur={refresh.flush}
                  aria-invalid={draftInvalid && !parsePlanningTime(departureTime) ? true : undefined}
                  required
                />
              </label>
            </div>
            <small>Saved in this share link. Sample timelines shift to your planning preference; they are not live schedules.</small>
          </div>
        </div>
        <button className="search-button" type="submit">
          Search trips <ArrowRight size={18} />
        </button>
      </form>
      <div className="search-footnote">
        <span>
          Try our demo: Philadelphia <ArrowRight size={12} /> Stony Brook
        </span>
        <span>Sample plans · Date/time are planning preferences, not live schedules.</span>
      </div>
    </section>
  );
}
