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

describe("typo-tolerant fallback", () => {
  const ids = (value: string, limit?: number) => sampleLocationCatalogue.suggest(value, limit).map((city) => city.id);

  it("suggests the intended sample city for misspellings with no normal match", () => {
    expect(ids("Bostn")).toEqual(["boston"]);
    expect(ids("Philadelpia")).toEqual(["philadelphia"]);
    expect(ids("  PHILADELPIA, ")).toEqual(["philadelphia"]);
    expect(ids("Phily")).toEqual(["philadelphia"]); // alias "Philly"
    expect(ids("Washingtn")).toEqual(["washington"]); // id spelling of "Washington, DC"
    expect(ids("Stoney Brook")).toEqual(["stony-brook"]);
    expect(ids("Bsotn")).toEqual(["boston"]); // adjacent swap + deletion = 2
  });

  it("needs 5+ letters and stays within edit distance 2", () => {
    expect(ids("Bstn")).toEqual([]); // 4 letters
    expect(ids("B-o-s-t")).toEqual([]); // punctuation does not count as letters
    expect(ids("Bostonian")).toEqual([]); // distance 3 from "boston"
    expect(ids("Atlantis")).toEqual([]);
    expect(ids("Pittsburgh")).toEqual([]);
  });

  it("never mixes typo guesses into normal results, so existing ranking is unchanged", () => {
    const catalogue = createLocationCatalogue([
      { id: "salem", name: "Salem", state: "MA" },
      { id: "salen", name: "Salen", state: "OR" },
    ]);
    expect(catalogue.suggest("Salem").map((city) => city.id)).toEqual(["salem"]);
    expect(ids("ch").slice(0, 2)).toEqual(["charlotte", "charleston"]);
    expect(ids("Boston")).toEqual(["boston"]);
  });

  it("ranks typo matches by distance, then catalogue order, before the limit", () => {
    const catalogue = createLocationCatalogue([
      { id: "two", name: "Bestan", state: "AA" },
      { id: "tie", name: "Bosttn", state: "BB" },
      { id: "one", name: "Boston", state: "CC" },
      { id: "far", name: "Bangor", state: "DD" },
    ]);
    expect(catalogue.suggest("Bostn").map((city) => city.id)).toEqual(["tie", "one", "two"]);
    expect(catalogue.suggest("Bostn", 1).map((city) => city.id)).toEqual(["tie"]);
  });
});
