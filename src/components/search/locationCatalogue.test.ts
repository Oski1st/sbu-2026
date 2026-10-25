import { describe, expect, it } from "vitest";
import { createLocationCatalogue, sampleLocationCatalogue } from "./locationCatalogue";

describe("location suggestion ranking", () => {
  it("puts Charlotte and Charleston before substring matches for ch", () => {
    const ids = sampleLocationCatalogue.suggest("ch").map((city) => city.id);
    expect(ids.slice(0, 2)).toEqual(["charlotte", "charleston"]);
    expect(ids.indexOf("richmond")).toBeGreaterThan(1);
  });

  it("ranks exact, name/alias prefix, word-start, then substring before applying the limit", () => {
    const catalogue = createLocationCatalogue([
      { id: "substring", name: "Boyork", state: "AA" },
      { id: "word", name: "New York", state: "BB" },
      { id: "alias-prefix", name: "Alias City", state: "CC", aliases: ["York Bay"] },
      { id: "prefix", name: "Yorkshire", state: "DD" },
      { id: "exact", name: "York", state: "EE" },
      { id: "alias-exact", name: "Another City", state: "FF", aliases: ["York"] },
    ]);
    expect(catalogue.suggest("  YORK ", 10).map((city) => city.id)).toEqual([
      "exact", "alias-exact", "alias-prefix", "prefix", "word", "substring",
    ]);
    expect(catalogue.suggest("york", 1)[0].id).toBe("exact");
  });

  it("uses catalogue order for ties and the empty focused list", () => {
    const entries = [
      { id: "b", name: "Boston", state: "MA" },
      { id: "a", name: "Boulder", state: "CO" },
    ];
    const catalogue = createLocationCatalogue(entries);
    expect(catalogue.suggest("bo").map((city) => city.id)).toEqual(["b", "a"]);
    expect(catalogue.suggest("")).toEqual(entries);
    expect(catalogue.suggest("Atlantis")).toEqual([]);
  });
});
