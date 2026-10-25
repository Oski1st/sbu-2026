import { useEffect, useId } from "react";
import type { ReactNode } from "react";
import { useInRouterContext, useLocation } from "react-router-dom";
import type { Leg } from "../../types/transit";
import { readSearchState } from "../../data/searchState";
import { purchaseLinkForLeg } from "../../lib/purchase";
import { rememberedSearchDate, rememberSearchDate } from "../../lib/purchase/dates";
import { AmtrakHandoff } from "../AmtrakHandoff";

/**
 * The user's Search date: `?date=` when present; on Search, the form's date
 * (today by default); elsewhere the date last searched in this tab; else today.
 */
export function useSearchDate(): string {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const explicit = params.has("date") ? readSearchState(params).departureDate : undefined;
  const onSearch = pathname === "/" || pathname === "/search";
  const fromSearch = explicit ?? (onSearch ? readSearchState(params).departureDate : undefined);
  useEffect(() => {
    if (fromSearch) rememberSearchDate(fromSearch);
  }, [fromSearch]);
  return fromSearch ?? rememberedSearchDate() ?? readSearchState(params).departureDate;
}

interface PurchaseLinkProps {
  leg: Leg;
  /** The trip's first departure, so later legs keep their day offset from the Search date. */
  tripStart?: string;
  /** Screen-reader context that keeps each link's name unique, e.g. "segment 2, Trenton to New York". */
  context?: string;
  className?: string;
  srOnlyClass?: string;
  icon?: ReactNode;
}

function PurchaseAnchor({ leg, tripStart, context, className, srOnlyClass = "sr-only", icon, searchDate }: PurchaseLinkProps & { searchDate?: string }) {
  const id = useId();
  const link = purchaseLinkForLeg(leg, searchDate, tripStart);
  const suffix = (
    <span className={srOnlyClass}>
      {context ? ` for ${context}` : ""}
      {link.copyText ? "; copies trip details" : ""} (opens in a new tab)
    </span>
  );
  if (link.copyText !== undefined) {
    return (
      <AmtrakHandoff details={{ ...leg, date: link.date }} href={link.href} copyText={link.copyText} note={link.note} kind={link.kind} className={className}>
        {link.label}
        {icon}
        {suffix}
      </AmtrakHandoff>
    );
  }
  return (
    <span className="purchase-link">
      <a href={link.href} target="_blank" rel="noreferrer" className={className} data-purchase-kind={link.kind} aria-describedby={link.note ? `${id}-note` : undefined}>
        {link.label}
        {icon}
        {suffix}
      </a>
      {link.note && <span id={`${id}-note`} className="purchase-link-note">{link.note}</span>}
    </span>
  );
}

function RoutedPurchaseLink(props: PurchaseLinkProps) {
  return <PurchaseAnchor {...props} searchDate={useSearchDate()} />;
}

/** Every ticket/purchase link renders through here and src/lib/purchase. */
export function PurchaseLink(props: PurchaseLinkProps) {
  return useInRouterContext() ? <RoutedPurchaseLink {...props} /> : <PurchaseAnchor {...props} />;
}
