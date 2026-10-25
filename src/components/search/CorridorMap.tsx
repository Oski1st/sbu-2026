import { useId } from "react";
import geometry from "../../data/railMap/geometry.json";
import audit from "../../data/railMap/serviceAudit.json";
import "./PassengerRailMap.css";

/**
 * A few orienting labels, positioned from the bundled station coordinates (no new geometry).
 * They are HTML so their text stays a fixed, legible size while the SVG scales. "place" sets
 * the label offset from its dot (see PassengerRailMap.css) so labels sit in open space clear of
 * neighbouring stations; "wideOnly" labels are hidden where the map is too narrow for them.
 */
const mapLabels = [
  { code: "BOS", text: "Boston", place: "right", wideOnly: false },
  { code: "NYP", text: "New York", place: "below-right", wideOnly: false },
  { code: "WAS", text: "Washington", place: "far-right", wideOnly: true },
  { code: "CLT", text: "Charlotte", place: "left", wideOnly: false },
  { code: "SAV", text: "Savannah", place: "right-low", wideOnly: false },
  { code: "TPA", text: "Tampa", place: "left", wideOnly: false },
  { code: "MIA", text: "Miami", place: "right", wideOnly: false },
] as const;
const [, , viewWidth, viewHeight] = geometry.viewBox;

export function CorridorMap() {
  const id = useId();
  const titleId = `${id}-rail-title`;
  const descriptionId = `${id}-rail-description`;
  return (
    <section className="passenger-rail-map" aria-labelledby={titleId}>
      <header className="prm-heading">
        <p className="prm-eyebrow">CONTIGUOUS UNITED STATES</p>
        <h2 id={titleId}>Amtrak corridors.</h2>
        <p>Where our sample trips run: Amtrak track between our 24 cities, plus the LIRR to Stony Brook.</p>
      </header>
      <div className="prm-frame">
        <svg className="prm-art" viewBox={geometry.viewBox.join(" ")} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <desc id={descriptionId}>North-up geographic map of the contiguous United States. Lines follow federal NTAD Amtrak track only between the cities in OneLine's sample network, from Portland, Maine to Miami, Charlotte and Tampa; track beyond our cities is not drawn. Dots mark 26 Amtrak train stations serving 23 of the 24 sample cities. A hollow marker shows Stony Brook's LIRR station, joined to New York by a dashed line because LIRR track is not in the federal data. This is the sample network, not a timetable or a guarantee of a direct connection. Read the corridor and city list below for boarding locations and gaps.</desc>
          <rect className="prm-water" width="800" height="420" rx="16" />
          <g className="prm-states">
            {geometry.boundaries.map((state) => <path key={state.name} d={state.path} />)}
          </g>
          <g className="prm-routes">
            {geometry.routes.map((route) => (
              <g key={route.id} data-route-id={route.id}>
                <title>{`${route.name}: Amtrak track between our sample cities`}</title>
                {route.paths.map((path, index) => <path key={index} d={path} vectorEffect="non-scaling-stroke" />)}
              </g>
            ))}
          </g>
          <g className="prm-stations">
            {geometry.stations.map((station) => (
              <g key={station.code} className="prm-station" data-station-code={station.code}>
                <title>{`${station.locality}: ${station.name} (${station.code})`}</title>
                {/* Zero-length round-capped strokes keep markers a constant on-screen size at every width. */}
                <path className="prm-station-halo" d={`M${station.x},${station.y}h0`} vectorEffect="non-scaling-stroke" />
                <path className="prm-station-dot" d={`M${station.x},${station.y}h0`} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </g>
          {/* Drawn after the Amtrak markers so the LIRR ring stays visible beside New Haven and New York. */}
          <g className="prm-lirr" data-station-code={geometry.lirr.id}>
            <title>{`${geometry.lirr.name}: LIRR from New York; track not drawn`}</title>
            <path className="prm-lirr-link" d={`M${geometry.lirr.schematicFrom.x},${geometry.lirr.schematicFrom.y}L${geometry.lirr.x},${geometry.lirr.y}`} vectorEffect="non-scaling-stroke" />
            <path className="prm-station-halo" d={`M${geometry.lirr.x},${geometry.lirr.y}h0`} vectorEffect="non-scaling-stroke" />
            <path className="prm-lirr-ring" d={`M${geometry.lirr.x},${geometry.lirr.y}h0`} vectorEffect="non-scaling-stroke" />
            <path className="prm-lirr-hole" d={`M${geometry.lirr.x},${geometry.lirr.y}h0`} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <ul className="prm-labels" aria-hidden="true">
          {mapLabels.map(({ code, text, place, wideOnly }) => {
            const station = geometry.stations.find((item) => item.code === code)!;
            return <li key={code} className={`prm-label prm-label-${place}${wideOnly ? " prm-label-wide-only" : ""}`} style={{ left: `${(station.x / viewWidth) * 100}%`, top: `${(station.y / viewHeight) * 100}%` }}>{text}</li>;
          })}
        </ul>
      </div>
      <ul className="prm-legend" aria-label="Rail map legend">
        <li><span className="prm-line-key" aria-hidden="true" />Amtrak track between our cities</li>
        <li><span className="prm-dot-key" aria-hidden="true" />Amtrak train station</li>
        <li><span className="prm-lirr-key" aria-hidden="true" />LIRR to Stony Brook (track not drawn)</li>
        <li>North up · Albers equal-area</li>
      </ul>
      <p className="prm-note">Federal route snapshot: May 2026. Stations: October 2026. Partial coverage; confirm service and boarding details with the operator. These lines do not change the sample itineraries.</p>
      <details className="prm-details">
        <summary>Corridors, cities &amp; coverage gaps</summary>
        <div className="prm-details-content" role="region" aria-label="Corridor, city and coverage-gap details" tabIndex={0}>
          <h3>Documented passenger corridors</h3>
          <p>Railway alignment comes from FRA/BTS NTAD. Passenger-service descriptions are checked against Amtrak's published route pages. Neither establishes a departure on your chosen date or a guaranteed transfer.</p>
          <p>Lines stop at our last city on each route. Services that continue further, such as the Floridian to Chicago, Empire Service to Niagara Falls, the Downeaster to Brunswick and Northeast Regional trains to Roanoke, are not drawn beyond our network.</p>
          <ul className="prm-route-list">
            {audit.routes.map((route) => <li key={route.id}><a href={route.url} target="_blank" rel="noreferrer">{route.name}<span className="prm-sr-only"> (official source, opens in a new tab)</span> ↗</a><p>{route.description}</p></li>)}
          </ul>
          <h3>All 24 sample-catalogue cities</h3>
          <p>Markers use train-station coordinates, not city centres. A nearby line alone is not proof that a particular train stops there.</p>
          <ul className="prm-city-list">
            {audit.cities.map((city) => <li key={city.id}>
              <strong>{city.name.endsWith(`, ${city.state}`) ? city.name : `${city.name}, ${city.state}`}</strong>
              <p>{city.note}</p>
              {city.codes.length > 0 ? <ul>{city.codes.map((code) => {
                const station = geometry.stations.find((item) => item.code === code)!;
                return <li key={code}><a href={`https://www.amtrak.com/stations/${code.toLowerCase()}.html`} target="_blank" rel="noreferrer">{station.locality} · {station.name} ({code})<span className="prm-sr-only"> (official station, opens in a new tab)</span> ↗</a></li>;
              })}</ul> : <a href={city.sourceUrl} target="_blank" rel="noreferrer">MTA station details · alignment not mapped<span className="prm-sr-only"> · {city.name} (opens in a new tab)</span> ↗</a>}
            </li>)}
          </ul>
          <h3>What is missing</h3>
          <ul className="prm-gap-list">{audit.operatorGaps.map((gap) => <li key={gap.operator}><strong>{gap.operator}:</strong> {gap.reason}{gap.url && <> <a href={gap.url} target="_blank" rel="noreferrer">Official source<span className="prm-sr-only"> · {gap.operator} (opens in a new tab)</span> ↗</a></>}</li>)}</ul>
          <p>Downeaster trains use Boston North Station. Northeast Regional uses South Station/Back Bay; no through-rail connector is drawn between them. Albany boarding is in Rensselaer; Charleston-area boarding is in North Charleston.</p>
          <p className="prm-sources">Sources: <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Routes/FeatureServer/0" target="_blank" rel="noreferrer">FRA/BTS alignments<span className="prm-sr-only"> (opens in a new tab)</span> ↗</a> · <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Stations/FeatureServer/0" target="_blank" rel="noreferrer">Amtrak station dataset<span className="prm-sr-only"> (opens in a new tab)</span> ↗</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth boundaries<span className="prm-sr-only"> (opens in a new tab)</span> ↗</a>. Public-domain geometry, checked {audit.checkedDate}, bundled offline. Shapes are generalized for this scale; they are not track-level navigation.</p>
        </div>
      </details>
    </section>
  );
}
