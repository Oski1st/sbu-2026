import overview from "../../data/usOverviewMap.json";

// Natural Earth 1:50m Admin 1 state boundaries are public domain. The bundled
// paths use an Albers equal-area projection for the contiguous U.S.; Alaska and
// Hawaii are explicitly labelled geographic insets. See usOverviewMap.json.
export function CorridorMap() {
  return (
    <div className="corridor-map-wrap nationwide-map-wrap">
      <div className="us-map-heading">
        <p className="us-map-title">United States geographic overview</p>
        <p className="us-map-subtitle">State boundaries · no nationwide service lines shown</p>
      </div>
      <div
        className="corridor-map nationwide-map"
        role="img"
        aria-describedby="us-map-note"
        aria-label="Geographic overview of the United States, showing state boundaries in the contiguous United States and labelled Alaska and Hawaii insets. It is not a route, schedule, or service-coverage map."
      >
        <svg viewBox="0 0 800 580" className="map-art" aria-hidden="true">
          <defs>
            <pattern id="us-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#cbd9c9" />
            </pattern>
          </defs>
          <rect width="800" height="580" fill="#e2ece7" />
          <rect width="800" height="580" fill="url(#us-grid)" opacity="0.5" />
          <g className="us-map-states">
            {overview.contiguous.map((state) => (
              <path key={state.name} d={state.path} />
            ))}
          </g>
          <g className="us-map-inset us-map-inset--alaska">
            <rect x="30" y="394" width="300" height="170" rx="10" />
            {overview.alaska.map((state) => <path key={state.name} d={state.path} />)}
            <text className="us-map-inset-label" x="48" y="430">ALASKA</text>
          </g>
          <g className="us-map-inset us-map-inset--hawaii">
            <rect x="360" y="394" width="240" height="170" rx="10" />
            {overview.hawaii.map((state) => <path key={state.name} d={state.path} />)}
            <text className="us-map-inset-label" x="380" y="430">HAWAII</text>
          </g>
          <g className="us-map-north" transform="translate(748 62)">
            <text y="-9">N</text>
            <path d="M0 0L-5 14H5Z" />
          </g>
        </svg>
      </div>
      <p className="us-map-inset-note">Alaska and Hawaii: geographic insets, not to scale.</p>
      <p className="map-city-legend" id="us-map-note">
        Geographic overview only. State boundaries are bundled for offline display; listed service areas and sample journeys are shown separately, and no nationwide connections are implied.
      </p>
    </div>
  );
}
