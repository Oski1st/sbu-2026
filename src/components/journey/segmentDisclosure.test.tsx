import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Leg } from "../../types/transit";
import { SegmentCard } from "./SegmentCard";
import { purchaseLinkForLeg } from "../../lib/purchase";

const leg: Leg = {
  id: "disclosure-rail", agency: "AMTRAK", line: "Sample rail segment",
  from: "Boston", to: "Philadelphia", purchaseUrl: "https://www.amtrak.com/",
  departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-24T13:00:00-04:00",
};

// The ticket link comes from the shared resolver (no router here, so the leg's own date applies).
const ticketHref = `href="${purchaseLinkForLeg(leg).href.replaceAll("&", "&amp;")}"`;

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
    // The ticket link sits outside the disclosure, so it stays usable while collapsed.
    expect(html).toContain(ticketHref);
    expect(html).toContain("focus-visible:outline-3");
  });

  it("renders exactly one ticket link per segment and never an inert or hidden copy inside the details", () => {
    for (const expanded of [false, true]) {
      const html = renderToStaticMarkup(card(expanded));
      const anchors = [...html.matchAll(/<a\b[^>]*>/g)];
      expect(anchors).toHaveLength(1);
      expect(anchors[0][0]).toContain(ticketHref);
      expect(anchors[0].index!).toBeLessThan(html.indexOf(`id="segment-details-${leg.id}"`));
      expect(html.slice(html.indexOf(`id="segment-details-${leg.id}"`))).not.toContain("<a ");
    }
  });

  it("toggles inert on the details in both directions while the ticket link stays put", () => {
    for (const expanded of [false, true, false]) {
      const html = renderToStaticMarkup(card(expanded));
      expect(disclosure(html).includes('inert=""')).toBe(!expanded);
      expect(disclosure(html)).toContain(`aria-hidden="${!expanded}"`);
      expect(html).toContain(`aria-expanded="${expanded}"`);
      expect(html).toContain(expanded ? "Hide trip details" : "View trip details");
      expect(html).toContain(ticketHref);
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
