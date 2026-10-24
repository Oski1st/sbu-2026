import overview from "../../data/usOverviewMap.json";

// Natural Earth 1:50m Admin 1 state boundaries are public domain. The bundled
// paths use an Albers equal-area projection for the contiguous U.S.; Alaska and
// Hawaii are explicitly labelled geographic insets. See usOverviewMap.json.
export function CorridorMap() {
  return (
    <div className="corridor-map-wrap nationwide-map-wrap">
      <div
        className="corridor-map nationwide-map"
        role="img"
        aria-describedby="us-map-note"
        aria-label="Geographic overview of the United States, showing state boundaries in the contiguous United States and labelled Alaska and Hawaii insets. It is not a route, schedule, or service-coverage map."
      >
        <svg viewBox="0 0 800 500" className="map-art" aria-hidden="true">
          <defs>
            <pattern id="us-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#cbd9c9" />
            </pattern>
          </defs>
          <rect width="800" height="500" fill="#e2ece7" />
          <rect width="800" height="500" fill="url(#us-grid)" opacity="0.5" />
          <text className="us-map-title" x="48" y="38">UNITED STATES GEOGRAPHIC OVERVIEW</text>
          <text className="us-map-subtitle" x="48" y="61">State boundaries · no nationwide service lines shown</text>
          <g className="us-map-states">
            {overview.contiguous.map((state) => (
              <path key={state.name} d={state.path} />
            ))}
          </g>
          <g className="us-map-inset us-map-inset--alaska">
            <rect x="30" y="385" width="215" height="95" rx="10" />
            {overview.alaska.map((state) => <path key={state.name} d={state.path} />)}
            <text className="us-map-inset-label" x="48" y="407">ALASKA</text>
            <text className="us-map-inset-note" x="48" y="423">geographic inset · not to scale</text>
          </g>
          <g className="us-map-inset us-map-inset--hawaii">
            <rect x="258" y="397" width="155" height="72" rx="10" />
            {overview.hawaii.map((state) => <path key={state.name} d={state.path} />)}
            <text className="us-map-inset-label" x="275" y="418">HAWAII</text>
            <text className="us-map-inset-note" x="275" y="434">geographic inset</text>
          </g>
          <g className="us-map-north" transform="translate(748 62)">
            <text y="-9">N</text>
            <path d="M0 0L-5 14H5Z" />
          </g>
        </svg>
      </div>
      <p className="map-city-legend" id="us-map-note">
        Geographic overview only. State boundaries are bundled for offline display; listed service areas and sample journeys are shown separately, and no nationwide connections are implied.
      </p>
    </div>
  );
}
