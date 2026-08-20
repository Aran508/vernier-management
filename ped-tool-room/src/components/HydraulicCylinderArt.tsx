/**
 * Hydraulic cylinder illustration for the login page's brand panel — brushed
 * steel barrel + chrome rod with real cylindrical shading, brand-colored end
 * caps (teal/steel), a cutaway window revealing a fixed amber sensing rod
 * and a small multicolor "smart electronics" block, plus a valve block
 * feeding both ports through curved hoses. Motion is hydraulic-accurate: a
 * quick pressurized extend with a cushioned settle, a dwell under load, then
 * a slower controlled retract. Reduced-motion users get a static mid-stroke
 * frame (see .cyl-rod / .cyl-port-a/b / .cyl-hose-a/b / .cyl-led in
 * globals.css).
 */
export function HydraulicCylinderArt() {
  return (
    <svg viewBox="0 0 480 200" className="w-full max-w-md" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cylBarrel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="16%" stopColor="#94a3b8" />
          <stop offset="48%" stopColor="#64748b" />
          <stop offset="80%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="cylCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="55%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="cylRod" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="22%" stopColor="#e2e8f0" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="cylMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="cylCapTeal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="55%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#0b4f4a" />
        </linearGradient>
        <linearGradient id="cylCapSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7d9bb0" />
          <stop offset="55%" stopColor="#1e3a4f" />
          <stop offset="100%" stopColor="#0f1f2e" />
        </linearGradient>
        <linearGradient id="cylSenseRod" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="230" cy="187" rx="185" ry="6" fill="#000000" opacity="0.10" />
      <ellipse cx="230" cy="187" rx="130" ry="4" fill="#000000" opacity="0.08" />

      {/* Rear pedestal (fixed mount) */}
      <rect x="14" y="150" width="54" height="13" rx="2.5" fill="url(#cylMetal)" stroke="#1e293b" strokeWidth="1" />
      <circle cx="27" cy="156.5" r="2.2" fill="#1e293b" />
      <circle cx="55" cy="156.5" r="2.2" fill="#1e293b" />
      <rect x="38" y="119" width="4" height="32" fill="url(#cylMetal)" />

      {/* Rear clevis (fixed) */}
      <rect x="32" y="94" width="18" height="26" rx="3.5" fill="url(#cylCap)" stroke="#1e293b" strokeWidth="1" />
      <circle cx="41" cy="107" r="4" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />

      {/* Valve block */}
      <g className="cyl-led-group">
        <rect x="96" y="148" width="46" height="26" rx="3" fill="url(#cylMetal)" stroke="#1e293b" strokeWidth="1" />
        <circle className="cyl-led" cx="119" cy="161" r="4" fill="var(--color-brand-teal)" />
        <rect x="104" y="167" width="8" height="4" rx="1" fill="#1e293b" opacity="0.6" />
        <rect x="126" y="167" width="8" height="4" rx="1" fill="#1e293b" opacity="0.6" />
      </g>

      {/* Hoses (curve from valve block up to each port) */}
      <g className="cyl-hose-a">
        <path d="M 108 148 C 92 122, 80 96, 76 66" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        <path d="M 108 148 C 92 122, 80 96, 76 66" className="cyl-hose-flow" stroke="var(--color-brand-teal)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" />
      </g>
      <g className="cyl-hose-b">
        <path d="M 130 148 C 150 118, 168 92, 176 66" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        <path d="M 130 148 C 150 118, 168 92, 176 66" className="cyl-hose-flow" stroke="var(--color-brand-ink-soft)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" />
      </g>

      {/* Barrel (fixed) */}
      <rect x="50" y="82" width="152" height="46" rx="9" fill="url(#cylBarrel)" stroke="#1e293b" strokeWidth="1.25" />
      <rect x="50" y="82" width="16" height="46" rx="9" fill="url(#cylCapTeal)" stroke="#1e293b" strokeWidth="1" />
      <rect x="186" y="82" width="16" height="46" rx="9" fill="url(#cylCapSteel)" stroke="#1e293b" strokeWidth="1" />
      <line x1="58" y1="88" x2="58" y2="122" stroke="#f1f5f9" strokeWidth="1" opacity="0.35" />

      {/* Cutaway window — smart-cylinder sensing element, visible through the housing */}
      <rect x="96" y="91" width="58" height="20" rx="4" fill="#f1f5f9" opacity="0.9" stroke="#94a3b8" strokeWidth="0.75" />
      <line x1="101" y1="101" x2="149" y2="101" stroke="url(#cylSenseRod)" strokeWidth="3" strokeLinecap="round" />
      <line x1="109" y1="96" x2="109" y2="106" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
      <line x1="121" y1="96" x2="121" y2="106" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
      <line x1="133" y1="96" x2="133" y2="106" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />
      <line x1="145" y1="96" x2="145" y2="106" stroke="#94a3b8" strokeWidth="1" opacity="0.6" />

      {/* Smart electronics block */}
      <rect x="162" y="90" width="18" height="18" rx="2.5" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
      <rect x="165.5" y="93.5" width="4.5" height="4.5" rx="0.75" fill="var(--color-brand-teal)" />
      <rect x="171.5" y="93.5" width="4.5" height="4.5" rx="0.75" fill="var(--color-brand-ink-soft)" />
      <rect x="165.5" y="99.5" width="4.5" height="4.5" rx="0.75" fill="#f59e0b" />
      <rect x="171.5" y="99.5" width="4.5" height="4.5" rx="0.75" fill="#38bdf8" />

      {/* Ports */}
      <g className="cyl-port-a">
        <line x1="76" y1="82" x2="76" y2="66" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="76" cy="62" r="4.5" fill="var(--color-brand-teal)" />
      </g>
      <g className="cyl-port-b">
        <line x1="176" y1="82" x2="176" y2="66" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="176" cy="62" r="4.5" fill="var(--color-brand-ink-soft)" />
      </g>

      {/* Rod + rod-end clevis (this group moves) */}
      <g className="cyl-rod">
        <rect x="188" y="96" width="142" height="15" rx="6" fill="url(#cylRod)" stroke="#475569" strokeWidth="1" />
        <rect x="188" y="98.5" width="142" height="2.5" rx="1.25" fill="#ffffff" opacity="0.65" />
        <rect x="328" y="88" width="17" height="30" rx="3.5" fill="url(#cylCap)" stroke="#1e293b" strokeWidth="1" />
        <circle cx="336.5" cy="103" r="4" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
      </g>

      {/* Labels */}
      <text x="126" y="142" textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="monospace" opacity="0.8">
        CYL-001 · SMART SENSOR · 10 MPa
      </text>
      <text x="76" y="50" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace" opacity="0.7">
        PORT A
      </text>
      <text x="176" y="50" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace" opacity="0.7">
        PORT B
      </text>
    </svg>
  );
}
