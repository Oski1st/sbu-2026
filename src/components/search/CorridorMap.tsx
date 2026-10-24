import { ArrowUpRight, TrainFront } from "lucide-react";
export function CorridorMap() {
  return (
    <div
      className="corridor-map"
      aria-label="Illustrative rail corridor connecting Philadelphia, Trenton, New York, Huntington and Stony Brook. Not geographically to scale."
      role="img"
    >
      <svg viewBox="0 0 640 430" className="map-art" aria-hidden="true">
        <defs>
          <pattern
            id="map-grid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="#cad5c4" />
          </pattern>
        </defs>
        <rect width="640" height="430" fill="url(#map-grid)" />
        <path
          d="M245-20C260 55 332 80 321 154S269 255 333 296 389 371 408 460H670V-20Z"
          fill="#dce8e4"
        />
        <path
          d="M396 149C436 132 502 109 650 92L664 172C558 165 480 182 423 196Z"
          fill="#f0f2e6"
          stroke="#cdd8c8"
        />
        <g fill="none" stroke="#cfd9c9" strokeWidth="1">
          <path d="M-5 112C124 110 179 65 245 34" />
          <path d="M-5 127C124 125 184 79 250 48" />
          <path d="M-5 142C124 140 189 93 255 62" />
          <path d="M50 430C110 327 215 347 254 243" />
          <path d="M71 430C131 327 236 347 275 243" />
          <path d="M92 430C152 327 257 347 296 243" />
        </g>
        <g
          fontFamily="Arial,sans-serif"
          fontSize="11"
          fill="#87988a"
          letterSpacing="2"
        >
          <text x="104" y="72">
            PENNSYLVANIA
          </text>
          <text x="220" y="345">
            NEW JERSEY
          </text>
          <text x="479" y="205" transform="rotate(-8 479 205)">
            LONG ISLAND
          </text>
        </g>
        <path
          className="map-track-shadow"
          d="M107 320L215 231Q227 220 241 220H327Q342 220 349 205L376 150H518"
        />
        <path
          d="M107 320L215 231Q227 220 241 220"
          fill="none"
          stroke="#497dc5"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M241 220H327Q342 220 349 205L376 150"
          fill="none"
          stroke="#d8834b"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M376 150H518"
          fill="none"
          stroke="#5c7dc8"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M107 320Q155 170 376 150"
          fill="none"
          stroke="#2e7969"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <g fill="#f7f8f0" stroke="#244d3e" strokeWidth="3">
          <circle cx="107" cy="320" r="8" />
          <circle cx="241" cy="220" r="6" />
          <circle cx="376" cy="150" r="8" />
          <circle cx="466" cy="150" r="5" />
          <circle cx="518" cy="150" r="8" />
        </g>
        <g fontFamily="Arial,sans-serif" fill="#244d3e">
          <text x="61" y="351" fontSize="16" fontWeight="700">
            Philadelphia
          </text>
          <text x="219" y="247" fontSize="12">
            Trenton
          </text>
          <text x="340" y="124" fontSize="14" fontWeight="700">
            New York
          </text>
          <text x="439" y="177" fontSize="10">
            Huntington
          </text>
          <text x="489" y="123" fontSize="15" fontWeight="700">
            Stony Brook
          </text>
          <text
            x="144"
            y="204"
            fontSize="10"
            transform="rotate(-32 144 204)"
            fill="#2e7969"
          >
            Amtrak connection
          </text>
        </g>
      </svg>
      <div className="map-stamp">
        <span className="stamp-icon">
          <TrainFront size={18} />
        </span>
        <div>
          Four networks.<strong>One way forward.</strong>
        </div>
        <ArrowUpRight size={19} />
      </div>
      <span className="map-caption">
        THE NORTHEAST, CONNECTED <span>↗</span>
      </span>
      <span className="map-scale">Illustrative network map</span>
    </div>
  );
}
