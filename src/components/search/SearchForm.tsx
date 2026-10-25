import { useState } from "react";
import {
  ArrowRight,
  ArrowDownUp,
  CalendarDays,
  MapPin,
  Circle,
} from "lucide-react";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { sampleLocationCatalogue, type LocationCatalogue } from "./locationCatalogue";
import { todayInNewYork } from "../../data/searchState";
import { IconTooltip } from "../ui/icon-tooltip";

const MAX_DATE = "9999-12-31";

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
    preferences: { departureDate: string; departureTime: string },
  ) => void;
}
export function SearchForm({
  onSearch,
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
          const form = event.currentTarget;
          const dateInput = form.elements.namedItem("departure-date");
          const today = todayInNewYork();
          // Chrome can roll a typed 5-digit year into e.g. 0270; never submit or share an out-of-range date.
          if (dateInput instanceof HTMLInputElement) {
            dateInput.setCustomValidity(
              /^\d{4}-\d{2}-\d{2}$/.test(departureDate) && departureDate >= today && departureDate <= MAX_DATE
                ? ""
                : `Choose a date from ${today} to ${MAX_DATE}.`,
            );
          }
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
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
                  }}
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
                  onChange={(event) => setDepartureTime(event.target.value)}
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
