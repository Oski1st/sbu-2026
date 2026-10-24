import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getLocationSuggestions,
  LocationAutocomplete,
} from "./LocationAutocomplete";

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

  test("keeps the sample-city catalogue bounded for an empty focused input", () => {
    expect(getLocationSuggestions("")).toHaveLength(8);
    expect(getLocationSuggestions("", 3)).toHaveLength(3);
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
