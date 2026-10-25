import { useId } from "react";
import geometry from "../../data/railMap/geometry.json";
import audit from "../../data/railMap/serviceAudit.json";
import "./PassengerRailMap.css";

export function CorridorMap() {
  const id = useId();
  const titleId = `${id}-rail-title`;
  const descriptionId = `${id}-rail-description`;
  return (
    <section className="passenger-rail-map" aria-labelledby={titleId}>
      <header className="prm-heading">
        <p className="prm-eyebrow">CONTIGUOUS UNITED STATES</p>
        <h2 id={titleId}>Follow the rails.</h2>
        <p>Selected Amtrak corridors serving our sample cities.</p>
      </header>
      <svg className="prm-art" viewBox={geometry.viewBox.join(" ")} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <desc id={descriptionId}>North-up geographic map of the contiguous United States. Eight selected Amtrak route alignments from the federal NTAD snapshot are drawn over state boundaries. Dots mark 26 Amtrak train stations serving 23 of the 24 sample-catalogue cities. Stony Brook's LIRR alignment is missing. This is partial rail coverage, not a timetable or a guarantee of a direct connection. Read the corridor and city list below for boarding locations and gaps.</desc>
        <rect className="prm-water" width="800" height="420" rx="16" />
        <g className="prm-states">
          {geometry.boundaries.map((state) => <path key={state.name} d={state.path} />)}
        </g>
        <g className="prm-routes">
          {geometry.routes.map((route) => (
            <g key={route.id} data-route-id={route.id}>
              <title>{`${route.name}: generalized rail alignment`}</title>
              {route.paths.map((path, index) => <path key={index} d={path} vectorEffect="non-scaling-stroke" />)}
            </g>
          ))}
        </g>
        <g className="prm-stations">
          {geometry.stations.map((station) => (
            <circle key={station.code} cx={station.x} cy={station.y} r="2.8" vectorEffect="non-scaling-stroke">
              <title>{`${station.locality}: ${station.name} (${station.code})`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <ul className="prm-legend" aria-label="Rail map legend">
        <li><span className="prm-line-key" aria-hidden="true" />Generalized Amtrak rail alignment</li>
        <li><span className="prm-dot-key" aria-hidden="true" />Amtrak train station</li>
        <li>North up · Albers equal-area</li>
      </ul>
      <p className="prm-note">Federal route snapshot: May 2026. Stations: October 2026. Partial coverage; confirm service and boarding details with the operator. These lines do not change the sample itineraries.</p>
      <details className="prm-details">
        <summary>Corridors, cities &amp; coverage gaps</summary>
        <div className="prm-details-content">
          <h3>Documented passenger corridors</h3>
          <p>Railway alignment comes from FRA/BTS NTAD. Passenger-service descriptions are checked against Amtrak's published route pages. Neither establishes a departure on your chosen date or a guaranteed transfer.</p>
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
              })}</ul> : <a href={city.sourceUrl} target="_blank" rel="noreferrer">MTA station details · alignment not mapped ↗</a>}
            </li>)}
          </ul>
          <h3>What is missing</h3>
          <ul className="prm-gap-list">{audit.operatorGaps.map((gap) => <li key={gap.operator}><strong>{gap.operator}:</strong> {gap.reason}{gap.url && <> <a href={gap.url} target="_blank" rel="noreferrer">Official source ↗</a></>}</li>)}</ul>
          <p>Downeaster trains use Boston North Station. Northeast Regional uses South Station/Back Bay; no through-rail connector is drawn between them. Albany boarding is in Rensselaer; Charleston-area boarding is in North Charleston.</p>
          <p className="prm-sources">Sources: <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Routes/FeatureServer/0" target="_blank" rel="noreferrer">FRA/BTS alignments ↗</a> · <a href="https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Stations/FeatureServer/0" target="_blank" rel="noreferrer">Amtrak station dataset ↗</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth boundaries ↗</a>. Public-domain geometry, checked {audit.checkedDate}, bundled offline. Shapes are generalized for this scale; they are not track-level navigation.</p>
        </div>
      </details>
    </section>
  );
}
