const stops = [
  [440, 56, "Portland"],
  [411, 94, "Boston"],
  [369, 142, "New York"],
  [320, 184, "Philadelphia"],
  [286, 224, "Washington, DC"],
  [251, 268, "Raleigh"],
  [276, 312, "Charleston"],
  [306, 354, "Orlando"],
  [354, 386, "Miami"],
] as const;
export function CorridorMap() {
  return (
    <div
      className="corridor-map east-map"
      role="img"
      aria-label="Illustrative East Coast rail and bus concept map from Maine to Florida, with a Long Island branch. Not an actual route map or geographically to scale."
    >
      <svg viewBox="0 0 640 430" className="map-art" aria-hidden="true">
        <defs>
          <pattern
            id="east-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="#cbd9c9" />
          </pattern>
        </defs>
        <rect width="640" height="430" fill="url(#east-grid)" />
        <path
          d="M465 0Q430 100 398 145T320 240Q310 280 355 330L399 430H640V0Z"
          fill="#dce9e4"
        />
        <text
          x="445"
          y="286"
          fill="#90a99d"
          fontSize="11"
          letterSpacing="4"
          transform="rotate(-65 445 286)"
        >
          ATLANTIC OCEAN
        </text>
        <path
          d="M440 56L411 94L369 142L320 184L286 224L251 268L276 312L306 354L354 386"
          fill="none"
          stroke="#bed4c3"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M440 56L411 94L369 142L320 184L286 224L251 268L276 312L306 354L354 386"
          fill="none"
          stroke="#2e7969"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M456 56L427 94L385 142L336 184L302 224L267 268L292 312L322 354L370 386"
          fill="none"
          stroke="#7e9b3b"
          strokeWidth="3"
          strokeDasharray="5 6"
        />
        <path
          d="M369 142L490 145"
          stroke="#5372c1"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle
          cx="490"
          cy="145"
          r="5"
          fill="#f7f8f0"
          stroke="#5372c1"
          strokeWidth="2"
        />
        <text x="465" y="127" fontSize="12" fill="#244d3e" fontWeight="700">
          Stony Brook
        </text>
        <g transform="translate(66 136)" fill="#526e5d" fontSize="10">
          <path d="M0 0H24" stroke="#2e7969" strokeWidth="3" />
          <text x="31" y="4">
            Rail concept
          </text>
          <path
            d="M0 19H24"
            stroke="#7e9b3b"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
          <text x="31" y="23">
            Coach concept
          </text>
        </g>
        {stops.map(([x, y, name]) => (
          <g key={name}>
            <circle
              cx={x}
              cy={y}
              r="5"
              fill="#fafbf2"
              stroke="#244d3e"
              strokeWidth="2.5"
            />
            <text
              x={x - 17}
              y={y + 4}
              textAnchor="end"
              fontSize={name === "Philadelphia" ? 13 : 12}
              fontWeight="700"
              fill="#244d3e"
            >
              {name}
            </text>
          </g>
        ))}
        <text x="66" y="78" fill="#768d77" fontSize="10" letterSpacing="3">
          MAINE TO FLORIDA
        </text>
        <text x="66" y="103" fill="#244d3e" fontSize="22" fontWeight="700">
          Go a little further.
        </text>
      </svg>
      <span className="map-caption">
        THE EAST COAST, REIMAGINED <span>↗</span>
      </span>
      <span className="map-scale">Concept map · Not verified service</span>
    </div>
  );
}
