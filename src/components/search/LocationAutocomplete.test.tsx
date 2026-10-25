import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getLocationSuggestions,
  LocationAutocomplete,
  suggestionOptionHandlers,
  optionStateLabel,
} from "./LocationAutocomplete";
import { createLocationCatalogue } from "./locationCatalogue";

describe("LocationAutocomplete catalogue matching", () => {
  test("matches the requested city aliases to catalogue cities", () => {
    expect(getLocationSuggestions("NYC").map((city) => city.id)).toEqual([
      "new-york",
    ]);
    expect(getLocationSuggestions("Philly").map((city) => city.id)).toEqual([
      "philadelphia",
    ]);
    expect(getLocationSuggestions("DC").map((city) => city.id)).toEqual([
      "washington",
    ]);
  });

  test("returns sample-catalogue matches and no unsupported-city matches", () => {
    expect(getLocationSuggestions("Portland")[0]).toMatchObject({
      name: "Portland",
      state: "ME",
    });
    expect(getLocationSuggestions("Atlantis")).toEqual([]);
  });

  test("does not repeat the state when the city name already includes it (W7)", () => {
    const [washington] = getLocationSuggestions("Wash");
    expect(washington.name).toBe("Washington, DC");
    expect(optionStateLabel(washington)).toBeNull();
    expect(optionStateLabel(getLocationSuggestions("Portland")[0])).toBe("ME");
  });

  test("keeps the sample-city catalogue bounded for an empty focused input", () => {
    expect(getLocationSuggestions("")).toHaveLength(8);
    expect(getLocationSuggestions("", 3)).toHaveLength(3);
  });

  test("distinguishes duplicate city names by state through the catalogue adapter", () => {
    const catalogue = createLocationCatalogue([
      { id: "portland-me", name: "Portland", state: "ME" },
      { id: "portland-or", name: "Portland", state: "OR" },
    ]);
    expect(catalogue.suggest("Portland")).toHaveLength(2);
    expect(catalogue.isSupported("Portland")).toBe(false);
    expect(catalogue.suggest("Portland, OR").map((city) => city.id)).toEqual(["portland-or"]);
    const city = catalogue.suggest("Portland, OR")[0];
    expect(catalogue.selectionValue(city)).toBe("Portland, OR");
    expect(catalogue.isSupported(catalogue.selectionValue(city))).toBe(true);
  });

  test("preserves manual unsupported text, all routing aliases, and bounded results", () => {
    expect(getLocationSuggestions("Long Island")[0].id).toBe("stony-brook");
    expect(getLocationSuggestions("Portland Maine")[0].id).toBe("portland");
    expect(getLocationSuggestions("", Number.POSITIVE_INFINITY)).toHaveLength(8);
    const html = renderToStaticMarkup(<LocationAutocomplete label="From" value="Atlantis" onChange={() => {}} />);
    expect(html).toContain('value="Atlantis"');
    expect(html).toContain("not yet a supported sample city");
  });
});

describe("LocationAutocomplete markup", () => {
  test("exposes an explicitly labelled controlled combobox", () => {
    const html = renderToStaticMarkup(
      <LocationAutocomplete
        id="origin-city"
        label="From"
        name="origin"
        value="Philadelphia"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('for="origin-city"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('aria-controls="origin-city-listbox"');
  });
});

describe("LocationAutocomplete suggestion press handlers", () => {
  test("cancels mousedown only, so WebKit touch taps still fire click", () => {
    let chosen = 0;
    const handlers = suggestionOptionHandlers(() => {
      chosen += 1;
    });
    expect(Object.keys(handlers).sort()).toEqual(["onClick", "onMouseDown"]);
    let prevented = false;
    handlers.onMouseDown({ preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    handlers.onClick();
    expect(chosen).toBe(1);
  });
});
