import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sampleLocationCatalogue, type LocationCatalogue, type LocationCity } from "./locationCatalogue";

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
  /** Indexed data input; catalogue membership alone never proves a route exists. */
  catalogue?: LocationCatalogue;
};

/** Returns cities from the local sample catalogue only; it never performs address lookup. */
export function getLocationSuggestions(
  value: string,
  maxSuggestions = 8,
): readonly LocationCity[] {
  return sampleLocationCatalogue.suggest(value, maxSuggestions);
}

/**
 * Press handlers for a suggestion option. Cancelling `mousedown` keeps focus in
 * the input for mouse users. `pointerdown` must not be cancelled: WebKit touch
 * (iOS Safari) then also drops the click that picks the city.
 */
export function suggestionOptionHandlers(onChoose: () => void) {
  return {
    onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
    onClick: () => onChoose(),
  };
}

/** Secondary option line; omitted when the name already ends with the state (e.g. "Washington, DC"). */
export function optionStateLabel(city: LocationCity): string | null {
  return city.name.trim().toLowerCase().endsWith(`, ${city.state.toLowerCase()}`) ? null : city.state;
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
  catalogue = sampleLocationCatalogue,
}: LocationAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? `location-${generatedId.replace(/:/g, "")}`;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxRef = useRef<HTMLUListElement>(null);
  const suggestions = useMemo(
    () => catalogue.suggest(value, maxSuggestions),
    [catalogue, maxSuggestions, value],
  );
  const hasTypedValue = value.trim().length > 0;
  const hasNoMatches = isOpen && hasTypedValue && suggestions.length === 0;
  const selectedIsSupported = hasTypedValue && catalogue.isSupported(value);
  useEffect(() => setActiveIndex(-1), [value, catalogue]);
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      listboxRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  const closeList = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };
  const chooseCity = (city: LocationCity) => {
    onChange(catalogue.selectionValue(city));
    closeList();
  };

  return (
    <div className="location-autocomplete relative min-w-0">
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
        maxLength={100}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={
          isOpen && activeIndex >= 0 && suggestions[activeIndex]
            ? `${inputId}-option-${suggestions[activeIndex].id}`
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
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            if (isOpen) event.preventDefault();
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
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
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
            <ul ref={listboxRef} id={listboxId} role="listbox" aria-label={`${label} supported cities`} className="max-h-64 overflow-y-auto">
              {suggestions.map((city, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    id={`${inputId}-option-${city.id}`}
                    key={city.id}
                    role="option"
                    aria-selected={isActive}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-left transition ${isActive ? "bg-slate-950 text-white" : "text-slate-900 hover:bg-slate-100"}`}
                    {...suggestionOptionHandlers(() => chooseCity(city))}
                  >
                    <span className="block font-semibold">{city.name}</span>
                    {optionStateLabel(city) && (
                      <span className={`block text-sm ${isActive ? "text-slate-200" : "text-slate-500"}`}>{optionStateLabel(city)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          {suggestions.length === 0 && (
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
