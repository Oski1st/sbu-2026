import regions from "../../data/eastCoastMap.json";

// Boundary source (public domain): Natural Earth 1:50m admin-1 states.
// https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson
// Simplified at 0.035 degrees, Mercator-projected; geography is bundled offline.
// Approximate city centres, projected with the same Mercator scale as the
// Natural Earth boundaries. Label offsets do not move the geographic markers.
const stops = [
  [408.3, 102.7, "Portland", 449, 82],
  [398.5, 124.2, "Boston", 449, 115],
  [362.7, 150.9, "New York", 415, 173],
  [348.7, 163, "Philadelphia", 367, 204],
  [325.9, 179.5, "Washington, DC", 262, 211],
  [306.5, 227.2, "Raleigh", 238, 246],
  [290.8, 271.4, "Charleston", 207, 289],
  [273.2, 331.2, "Orlando", 209, 345],
  [287.6, 369.1, "Miami", 324, 381],
] as const;
const conceptPath = stops.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

export function CorridorMap() {
  return (
    <div className="corridor-map east-map" role="img" aria-label="Geographic map of the eastern United States, with state boundaries and city markers from Portland, Maine to Miami, Florida and Stony Brook on Long Island. Dashed city connections are illustrative concepts, not verified services or actual rail and road alignments.">
      <svg viewBox="0 0 640 430" className="map-art" aria-hidden="true">
        <defs>
          <pattern id="east-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".8" fill="#cbd9c9" />
          </pattern>
          <clipPath id="east-map-clip"><rect x="25" y="30" width="590" height="365" rx="12" /></clipPath>
        </defs>
        <g clipPath="url(#east-map-clip)">
          <rect width="640" height="430" fill="#e2ece7" />
          {regions.map((region) => <path key={region.name} d={region.path} fill="#f2f4e9" stroke="#c5d2c0" strokeWidth=".8" fillRule="evenodd" />)}
          <rect width="640" height="430" fill="url(#east-grid)" opacity=".45" />
          <text x="452" y="290" fill="#78958a" fontSize="10" letterSpacing="3" transform="rotate(-57 452 290)">ATLANTIC OCEAN</text>
          <path d={conceptPath} fill="none" stroke="#fffef7" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={conceptPath} fill="none" stroke="#2e7969" strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M362.7 150.9L373.2 147.5" fill="none" stroke="#5372c1" strokeWidth="3" />
          {stops.map(([x, y, name, lx, ly]) => (
            <g key={name}>
              <path d={`M${x} ${y}L${lx - 5} ${ly - 4}`} fill="none" stroke="#82978c" strokeWidth=".8" />
              <circle cx={x} cy={y} r="3.8" fill="#fafbf2" stroke="#244d3e" strokeWidth="2" />
              <text x={lx} y={ly} fontSize="11" fontWeight="700" fill="#244d3e" stroke="#f5f7ed" strokeWidth="3" paintOrder="stroke">{name}</text>
            </g>
          ))}
          <path d="M373.2 147.5L460 145" stroke="#82978c" strokeWidth=".8" />
          <circle cx="373.2" cy="147.5" r="3.2" fill="#f7f8f0" stroke="#5372c1" strokeWidth="2" />
          <text x="467" y="149" fontSize="11" fill="#244d3e" fontWeight="700">Stony Brook</text>
          <g transform="translate(72 78)" fill="#526e5d" fontSize="10">
            <text fontSize="11" fontWeight="700" letterSpacing="2">EASTERN UNITED STATES</text>
            <path d="M0 20H24" stroke="#2e7969" strokeWidth="2.5" strokeDasharray="4 4" />
            <text x="31" y="24">Concept connections</text>
          </g>
          <g transform="translate(566 65)" fill="#526e5d" textAnchor="middle"><text fontSize="10" y="-8">N</text><path d="M0 0L-4 12H4Z" /></g>
        </g>
      </svg>
      <span className="map-caption">MAINE TO FLORIDA <span>↗</span></span>
      <span className="map-scale">Natural Earth geography · Connections unverified</span>
    </div>
  );
}
