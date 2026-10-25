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

interface Props {
  initialOrigin?: string;
  initialDestination?: string;
  /** Planning preferences are persisted for sharing, but never rewrite sample itinerary times. */
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
  initialDepartureDate = "2026-10-24",
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
          LET’S GET YOU THERE
        </span>
        <small>One-way · Rail + intercity bus</small>
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
            onChange={setOrigin}
            required
            placeholder="Departure city"
            catalogue={catalogue}
          />
        </div>
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
        <div className="location-field destination-field">
          <MapPin size={19} />
          <LocationAutocomplete
            id="destination"
            name="destination"
            label="To"
            value={destination}
            onChange={setDestination}
            required
            placeholder="Where to?"
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
                  onChange={(event) => setDepartureDate(event.target.value)}
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
            <small>Saved in this share link. Sample itinerary times do not change.</small>
          </div>
        </div>
        <button className="search-button" type="submit">
          Find my way <ArrowRight size={18} />
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
