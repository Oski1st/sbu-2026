import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Leg } from "../../types/transit";
import { SegmentCard } from "./SegmentCard";

const leg: Leg = {
  id: "disclosure-rail", agency: "AMTRAK", line: "Sample rail segment",
  from: "Boston", to: "Philadelphia", purchaseUrl: "https://www.amtrak.com/",
  departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-24T13:00:00-04:00",
};

function card(isExpanded: boolean, fixture = leg) {
  return <SegmentCard leg={fixture} index={0} isExpanded={isExpanded} isDelayed={false} isCurrent={false} onToggle={() => {}} />;
}

function disclosure(html: string, id = leg.id) {
  const attributes = html.match(new RegExp(`<div([^>]*id="segment-details-${id}"[^>]*)>`))?.[1];
  if (!attributes) throw new Error("Missing controlled disclosure container");
  return attributes;
}

describe("SegmentCard details disclosure", () => {
  it("makes collapsed contents inert and unavailable to the accessibility tree", () => {
    const html = renderToStaticMarkup(card(false));
    expect(disclosure(html)).toContain('inert=""');
    expect(disclosure(html)).toContain('aria-hidden="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`aria-controls="segment-details-${leg.id}"`);
    expect(html).toContain("View trip details");
    // The link is preserved for expansion; native inert removes it from focus/AT.
    expect(html).toContain(`href="${leg.purchaseUrl}"`);
    expect(html).toContain("focus-visible:ring-2");
  });

  it("restores link access only in the expanded state, then re-applies inert on collapse", () => {
    for (const expanded of [false, true, false]) {
      const html = renderToStaticMarkup(card(expanded));
      expect(disclosure(html).includes('inert=""')).toBe(!expanded);
      expect(disclosure(html)).toContain(`aria-hidden="${!expanded}"`);
      expect(html).toContain(`aria-expanded="${expanded}"`);
      expect(html).toContain(expanded ? "Hide trip details" : "View trip details");
      expect(html).toContain(`href="${leg.purchaseUrl}"`);
    }
  });

  it("keeps separate card controls and inert states independent", () => {
    const otherLeg = { ...leg, id: "disclosure-other" };
    const html = renderToStaticMarkup(<>{card(false)}{card(true, otherLeg)}</>);
    expect(disclosure(html, leg.id)).toContain('inert=""');
    expect(disclosure(html, otherLeg.id)).not.toContain('inert=""');
    for (const fixture of [leg, otherLeg]) {
      expect(html.match(new RegExp(`id="segment-details-${fixture.id}"`, "g"))).toHaveLength(1);
      expect(html).toContain(`aria-controls="segment-details-${fixture.id}"`);
    }
  });
});
