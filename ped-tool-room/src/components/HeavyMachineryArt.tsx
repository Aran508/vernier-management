/**
 * Heavy plant on a working site — a tracked excavator and a dozer either side
 * of an aggregate mound. Used as the brand visual on the dashboard hero and,
 * animated, behind the login card.
 *
 * `animated` runs a real work cycle: the excavator boom swings down, curls the
 * bucket, lifts and slews to dump, while the dozer pushes forward against its
 * blade and backs off. Everything is transform/opacity only, and the whole
 * thing freezes to a composed still frame under prefers-reduced-motion
 * (see .rig-* rules in globals.css).
 */
export function HeavyMachineryArt({ animated = false }: { animated?: boolean }) {
  const a = (cls: string) => (animated ? cls : undefined);

  return (
    <svg
      viewBox="0 0 900 380"
      className="h-full w-full"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="rigOrange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="55%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>
        <linearGradient id="rigYellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="55%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="rigSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="rigMound" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="rigGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>

      {/* Ground line */}
      <line x1="20" y1="330" x2="880" y2="330" stroke="#334155" strokeWidth="2.5" opacity="0.55" />

      {/* Aggregate mound */}
      <path d="M 330 330 L 420 236 L 470 256 L 520 214 L 610 330 Z" fill="url(#rigMound)" />
      <path d="M 330 330 L 420 236 L 452 268 L 400 330 Z" fill="#0f1f2e" opacity="0.13" />
      {[
        [402, 288], [432, 300], [462, 286], [492, 302], [522, 288],
        [418, 312], [452, 316], [488, 314], [546, 310], [382, 316],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 4.5 : 3} fill="#1e293b" opacity="0.28" />
      ))}

      {/* ── EXCAVATOR (left) ───────────────────────────────────────── */}
      <g className={a("rig-excavator")}>
        {/* Tracks */}
        <rect x="60" y="292" width="188" height="38" rx="19" fill="url(#rigSteel)" stroke="#0f1f2e" strokeWidth="2.5" />
        <rect x="76" y="302" width="156" height="18" rx="9" fill="#0f1f2e" opacity="0.42" />
        {[92, 116, 140, 164, 188, 212].map((cx) => (
          <circle key={cx} cx={cx} cy={311} r="7" fill="#334155" stroke="#0f1f2e" strokeWidth="1.5" />
        ))}

        {/* Slew ring + house */}
        <rect x="96" y="278" width="116" height="16" rx="4" fill="#334155" stroke="#0f1f2e" strokeWidth="2" />
        <path d="M 100 278 L 100 214 Q 100 206 108 206 L 214 206 Q 222 206 222 214 L 222 278 Z" fill="url(#rigOrange)" stroke="#0f1f2e" strokeWidth="2.5" />
        <rect x="112" y="220" width="42" height="16" rx="3" fill="#0f1f2e" opacity="0.35" />

        {/* Counterweight */}
        <rect x="88" y="240" width="18" height="42" rx="4" fill="#9a3412" stroke="#0f1f2e" strokeWidth="2" />

        {/* Cab */}
        <path d="M 168 206 L 168 154 Q 168 146 176 146 L 214 146 Q 222 146 222 154 L 222 206 Z" fill="url(#rigOrange)" stroke="#0f1f2e" strokeWidth="2.5" />
        <path d="M 176 200 L 176 158 Q 176 154 180 154 L 214 154 L 214 200 Z" fill="url(#rigGlass)" stroke="#0f1f2e" strokeWidth="1.75" />
        <line x1="195" y1="154" x2="195" y2="200" stroke="#0f1f2e" strokeWidth="1.25" opacity="0.45" />

        {/* Boom → stick → bucket, pivoting at the house */}
        <g className={a("rig-boom")} style={{ transformOrigin: "212px 250px" }}>
          <path d="M 208 258 L 244 190 L 268 196 L 240 264 Z" fill="url(#rigOrange)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M 244 190 L 268 196 L 330 232 L 320 248 Z" fill="url(#rigOrange)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
          {/* Boom cylinder */}
          <line x1="222" y1="252" x2="262" y2="212" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" />
          <line x1="222" y1="252" x2="250" y2="224" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />

          <g className={a("rig-stick")} style={{ transformOrigin: "325px 240px" }}>
            <path d="M 318 228 L 372 268 L 362 284 L 308 246 Z" fill="url(#rigOrange)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="322" y1="236" x2="360" y2="264" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

            {/* Bucket */}
            <g className={a("rig-bucket")} style={{ transformOrigin: "367px 276px" }}>
              <path d="M 358 268 L 400 268 Q 406 268 404 276 L 396 298 Q 393 306 384 306 L 360 306 Q 352 306 352 296 Z" fill="url(#rigSteel)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
              {[360, 371, 382, 393].map((x) => (
                <path key={x} d={`M ${x} 304 l 3 8 l 4 -8 Z`} fill="#334155" stroke="#0f1f2e" strokeWidth="1.25" />
              ))}
            </g>
          </g>
        </g>
      </g>

      {/* ── DOZER (right) ──────────────────────────────────────────── */}
      <g className={a("rig-dozer")}>
        {/* Tracks */}
        <path d="M 648 330 L 640 300 Q 638 290 650 290 L 812 290 Q 824 290 822 300 L 814 330 Z" fill="url(#rigSteel)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
        {[664, 690, 716, 742, 768, 794].map((cx) => (
          <circle key={cx} cx={cx} cy={311} r="8" fill="#334155" stroke="#0f1f2e" strokeWidth="1.5" />
        ))}
        <path d="M 654 300 L 810 300" stroke="#0f1f2e" strokeWidth="3" opacity="0.4" />

        {/* Body */}
        <path d="M 664 290 L 664 240 Q 664 232 672 232 L 804 232 Q 812 232 812 240 L 812 290 Z" fill="url(#rigYellow)" stroke="#0f1f2e" strokeWidth="2.5" />
        <rect x="676" y="248" width="46" height="14" rx="3" fill="#0f1f2e" opacity="0.3" />

        {/* Cab */}
        <path d="M 706 232 L 706 178 Q 706 170 714 170 L 782 170 Q 790 170 790 178 L 790 232 Z" fill="url(#rigYellow)" stroke="#0f1f2e" strokeWidth="2.5" />
        <path d="M 714 226 L 714 182 Q 714 178 718 178 L 782 178 L 782 226 Z" fill="url(#rigGlass)" stroke="#0f1f2e" strokeWidth="1.75" />
        <line x1="748" y1="178" x2="748" y2="226" stroke="#0f1f2e" strokeWidth="1.25" opacity="0.45" />

        {/* Exhaust stack + puff */}
        <rect x="678" y="196" width="13" height="38" rx="3" fill="#334155" stroke="#0f1f2e" strokeWidth="2" />
        <rect x="674" y="190" width="21" height="9" rx="3" fill="#475569" stroke="#0f1f2e" strokeWidth="1.75" />
        <circle className={a("rig-smoke rig-smoke-1")} cx="684" cy="176" r="8" fill="#94a3b8" opacity={animated ? 0 : 0.3} />
        <circle className={a("rig-smoke rig-smoke-2")} cx="690" cy="160" r="11" fill="#94a3b8" opacity={animated ? 0 : 0.22} />
        <circle className={a("rig-smoke rig-smoke-3")} cx="697" cy="142" r="14" fill="#94a3b8" opacity={animated ? 0 : 0.14} />

        {/* Push arm + blade */}
        <line x1="668" y1="286" x2="622" y2="296" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
        <g className={a("rig-blade")} style={{ transformOrigin: "620px 296px" }}>
          <path d="M 630 236 Q 604 268 606 322 L 586 322 Q 584 264 612 232 Z" fill="url(#rigSteel)" stroke="#0f1f2e" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M 586 316 L 606 316" stroke="#0f1f2e" strokeWidth="4" strokeLinecap="round" />
          <line x1="612" y1="248" x2="626" y2="252" stroke="#0f1f2e" strokeWidth="2" opacity="0.5" />
          <line x1="606" y1="276" x2="622" y2="279" stroke="#0f1f2e" strokeWidth="2" opacity="0.5" />
        </g>
      </g>

      {/* Ground dust kicked up between the machines */}
      <ellipse className={a("rig-dust")} cx="500" cy="328" rx="120" ry="9" fill="#94a3b8" opacity={animated ? 0 : 0.22} />
    </svg>
  );
}
