import { useId, useMemo, useState } from "react";
import { cities } from "../../data/eastCoast";

type City = (typeof cities)[number];

/**
 * Controlled city picker for OneLine's sample planning catalogue.
 *
 * `value` and `onChange` intentionally accept ordinary text: a selected city
 * remains editable, and the parent controls whether it is valid for search.
 */
export type LocationAutocompleteProps = {
  /** A unique, descriptive label such as "From" or "To". */
  label: string;
  /** Controlled text shown in the input. */
  value: string;
  /** Receives typed text or the selected catalogue city name. */
  onChange: (value: string) => void;
  /** Optional stable input ID. A React-generated unique ID is used otherwise. */
  id?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Limits the visible list while preserving the full sample catalogue search. */
  maxSuggestions?: number;
};

const aliases: Record<string, string> = {
  nyc: "new-york",
  "new york city": "new-york",
  philly: "philadelphia",
  dc: "washington",
  "washington dc": "washington",
  "washington d c": "washington",
};

const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");

const searchableText = (city: City) =>
  [city.id, city.name, city.state, `${city.name} ${city.state}`]
    .map(normalize)
    .join(" ");

/** Returns cities from the local sample catalogue only; it never performs address lookup. */
export function getLocationSuggestions(
  value: string,
  maxSuggestions = 8,
): City[] {
  const query = normalize(value);
  const aliasTarget = aliases[query];

  if (!query) return cities.slice(0, maxSuggestions);

  return cities
    .filter((city) => {
      if (city.id === aliasTarget) return true;
      const haystack = searchableText(city);
      return haystack.includes(query) || city.id.startsWith(query);
    })
    .slice(0, maxSuggestions);
}

function isSupportedCity(value: string) {
  const query = normalize(value);
  return cities.some(
    (city) =>
      city.id === aliases[query] ||
      city.id === query ||
      normalize(city.name) === query ||
      normalize(`${city.name}, ${city.state}`) === query,
  );
}

export function LocationAutocomplete({
  label,
  value,
  onChange,
  id,
  name,
  placeholder = "Choose a supported city",
  required = false,
  disabled = false,
  maxSuggestions = 8,
}: LocationAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? `location-${generatedId.replace(/:/g, "")}`;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(
    () => getLocationSuggestions(value, maxSuggestions),
    [maxSuggestions, value],
  );
  const hasTypedValue = value.trim().length > 0;
  const hasNoMatches = isOpen && hasTypedValue && suggestions.length === 0;
  const selectedIsSupported = hasTypedValue && isSupportedCity(value);

  const closeList = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };
  const chooseCity = (city: City) => {
    onChange(city.name);
    closeList();
  };

  return (
    <div className="relative min-w-0">
      <label htmlFor={inputId} className="block text-xs font-bold tracking-[0.12em] text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type="text"
        role="combobox"
        value={value}
        disabled={disabled}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${inputId}-option-${suggestions[activeIndex]?.id}`
            : undefined
        }
        aria-describedby={statusId}
        onFocus={() => {
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onBlur={closeList}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeList();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) =>
              suggestions.length ? Math.min(index + 1, suggestions.length - 1) : -1,
            );
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) =>
              suggestions.length
                ? index <= 0
                  ? suggestions.length - 1
                  : index - 1
                : -1,
            );
            return;
          }
          if (event.key === "Enter" && isOpen && activeIndex >= 0) {
            const city = suggestions[activeIndex];
            if (city) {
              event.preventDefault();
              chooseCity(city);
            }
          }
        }}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/15 disabled:cursor-not-allowed disabled:bg-slate-100"
      />

      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {hasNoMatches
          ? "No supported sample cities match this text."
          : isOpen
            ? `${suggestions.length} supported sample ${suggestions.length === 1 ? "city" : "cities"} available.`
            : ""}
      </p>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {suggestions.length > 0 ? (
            <ul id={listboxId} role="listbox" aria-label={`${label} supported cities`} className="max-h-64 overflow-y-auto">
              {suggestions.map((city, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    id={`${inputId}-option-${city.id}`}
                    key={city.id}
                    role="option"
                    aria-selected={isActive}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-left transition ${isActive ? "bg-slate-950 text-white" : "text-slate-900 hover:bg-slate-100"}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseCity(city)}
                  >
                    <span className="block font-semibold">{city.name}</span>
                    <span className={`block text-sm ${isActive ? "text-slate-200" : "text-slate-500"}`}>{city.state}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-slate-600">
              No supported sample cities match “{value}”. Try a city from the OneLine sample catalogue.
            </p>
          )}
        </div>
      )}

      {hasTypedValue && !selectedIsSupported && !hasNoMatches && (
        <p className="mt-1 text-sm text-amber-800">
          This is not yet a supported sample city. Choose a suggestion to use the sample catalogue.
        </p>
      )}
    </div>
  );
}
