import { useState } from "react";
import {
  ArrowRight,
  ArrowDownUp,
  CalendarDays,
  MapPin,
  Circle,
} from "lucide-react";
interface Props {
  onSearch: (origin: string, destination: string) => void;
}
export function SearchForm({ onSearch }: Props) {
  const [origin, setOrigin] = useState("Philadelphia");
  const [destination, setDestination] = useState("Stony Brook");
  return (
    <section className="search-section" aria-label="Plan your journey">
      <div className="search-heading">
        <span>
          <i />
          LET’S GET YOU THERE
        </span>
        <small>One-way · Rail journeys</small>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(origin, destination);
        }}
        className="search-form"
      >
        <div className="location-field">
          <Circle size={17} />
          <label htmlFor="origin">
            FROM
            <input
              id="origin"
              name="origin"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              list="station-options"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Departure city"
            />
          </label>
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
          <label htmlFor="destination">
            TO
            <input
              id="destination"
              name="destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              list="station-options"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Where to?"
            />
          </label>
        </div>
        <div className="date-field">
          <CalendarDays size={19} />
          <div>
            <span>DEMO DEPARTURE</span>
            <strong>Sat, Oct 24, 2026</strong>
          </div>
        </div>
        <button className="search-button" type="submit">
          Find my way <ArrowRight size={18} />
        </button>
        <datalist id="station-options">
          <option value="Philadelphia" />
          <option value="Stony Brook" />
          <option value="New York" />
          <option value="Trenton" />
        </datalist>
      </form>
      <div className="search-footnote">
        <span>
          Try our demo: Philadelphia <ArrowRight size={12} /> Stony Brook
        </span>
        <span>Sample schedules & fares. No live arrivals.</span>
      </div>
    </section>
  );
}
