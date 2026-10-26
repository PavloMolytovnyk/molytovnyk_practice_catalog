import type { Product } from '../types';

interface ProductArtworkProps {
  product: Product;
  className?: string;
}

export function ProductArtwork({ product, className = '' }: ProductArtworkProps) {
  const common = { fill: product.accent, stroke: '#101424', strokeWidth: 3 };

  return (
    <div
      className={`product-art ${className}`}
      style={{ '--art-bg': product.color, '--art-accent': product.accent } as React.CSSProperties}
      role="img"
      aria-label={`Ілюстрація товару ${product.name}`}
    >
      <span className="art-orbit art-orbit-one" />
      <span className="art-orbit art-orbit-two" />
      <svg viewBox="0 0 240 220" aria-hidden="true" focusable="false">
        {product.art === 'watch' && (
          <>
            <rect x="98" y="8" width="44" height="204" rx="21" fill="#111522" opacity=".92" />
            <rect x="70" y="51" width="100" height="118" rx="29" {...common} />
            <rect x="78" y="59" width="84" height="102" rx="23" fill="#151b2f" />
            <circle cx="120" cy="109" r="27" fill="none" stroke="#fff" strokeWidth="8" opacity=".92" />
            <path d="M120 82A27 27 0 0 1 145 99" fill="none" stroke="#6ff0d8" strokeWidth="8" strokeLinecap="round" />
            <circle cx="120" cy="109" r="5" fill="#fff" />
            <rect x="170" y="94" width="7" height="30" rx="3.5" fill="#101424" />
          </>
        )}
        {product.art === 'headphones' && (
          <>
            <path d="M63 118V93c0-42 25-68 57-68s57 26 57 68v25" fill="none" stroke="#111522" strokeWidth="18" strokeLinecap="round" />
            <path d="M70 94c0-36 21-58 50-58s50 22 50 58" fill="none" stroke="#fff" strokeWidth="7" opacity=".78" />
            <rect x="42" y="102" width="54" height="86" rx="24" {...common} />
            <rect x="144" y="102" width="54" height="86" rx="24" {...common} />
            <rect x="53" y="114" width="32" height="62" rx="15" fill="#20283a" />
            <rect x="155" y="114" width="32" height="62" rx="15" fill="#20283a" />
          </>
        )}
        {product.art === 'lamp' && (
          <>
            <ellipse cx="121" cy="193" rx="72" ry="17" fill="#121727" opacity=".2" />
            <rect x="77" y="177" width="90" height="16" rx="8" fill="#171c2d" />
            <path d="M119 178V93l34-42" fill="none" stroke="#171c2d" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M150 52l23 18" stroke="#171c2d" strokeWidth="11" strokeLinecap="round" />
            <path d="M148 37c34 1 52 18 56 47h-81c3-28 10-43 25-47Z" {...common} />
            <path d="M131 84h65" stroke="#fff5cf" strokeWidth="8" strokeLinecap="round" opacity=".9" />
            <circle cx="119" cy="179" r="7" fill="#fff" />
          </>
        )}
        {product.art === 'backpack' && (
          <>
            <path d="M87 62c1-23 14-35 33-35s32 12 33 35" fill="none" stroke="#121727" strokeWidth="12" strokeLinecap="round" />
            <rect x="58" y="51" width="124" height="151" rx="38" {...common} />
            <path d="M72 100h96" stroke="#101424" strokeWidth="5" opacity=".5" />
            <rect x="79" y="116" width="82" height="61" rx="23" fill="#101424" opacity=".84" />
            <path d="M93 130h54" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".75" />
            <path d="M57 92H44v67" fill="none" stroke="#101424" strokeWidth="10" strokeLinecap="round" />
            <path d="M183 92h13v67" fill="none" stroke="#101424" strokeWidth="10" strokeLinecap="round" />
          </>
        )}
        {product.art === 'keyboard' && (
          <>
            <path d="M34 71h172l14 97H20l14-97Z" {...common} strokeLinejoin="round" />
            {Array.from({ length: 5 }).map((_, row) =>
              Array.from({ length: row === 4 ? 7 : 10 }).map((__, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={31 + col * 18 + (row === 4 ? 18 : 0)}
                  y={82 + row * 16}
                  width={14}
                  height={11}
                  rx={2.5}
                  fill={row === 4 && col === 3 ? '#ffffff' : '#1b2134'}
                  opacity={row === 4 && col === 3 ? 0.92 : 0.86}
                />
              )),
            )}
            <rect x="83" y="146" width="73" height="10" rx="3" fill="#fff" opacity=".8" />
          </>
        )}
        {product.art === 'speaker' && (
          <>
            <rect x="63" y="36" width="114" height="156" rx="34" {...common} />
            <rect x="75" y="49" width="90" height="130" rx="25" fill="#171d30" />
            <circle cx="120" cy="108" r="35" fill="#2d3650" stroke="#fff" strokeOpacity=".7" strokeWidth="4" />
            <circle cx="120" cy="108" r="16" fill={product.accent} />
            <circle cx="120" cy="108" r="7" fill="#fff" opacity=".9" />
            <circle cx="102" cy="64" r="4" fill="#fff" />
            <circle cx="119" cy="64" r="4" fill="#fff" opacity=".55" />
            <circle cx="136" cy="64" r="4" fill="#fff" opacity=".55" />
          </>
        )}
        {product.art === 'mug' && (
          <>
            <path d="M80 36h80l-8 158H88L80 36Z" {...common} strokeLinejoin="round" />
            <rect x="76" y="28" width="88" height="20" rx="10" fill="#121727" />
            <rect x="92" y="14" width="56" height="22" rx="8" fill="#30384e" />
            <path d="M101 73h38" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".85" />
            <path d="M101 89h25" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".45" />
            <ellipse cx="120" cy="195" rx="46" ry="9" fill="#101424" opacity=".18" />
          </>
        )}
        {product.art === 'powerbank' && (
          <>
            <g transform="rotate(-8 120 110)">
              <rect x="63" y="29" width="114" height="169" rx="28" {...common} />
              <rect x="77" y="44" width="86" height="139" rx="19" fill="#171d30" />
              <rect x="91" y="65" width="58" height="45" rx="12" fill="#0a0e19" />
              <text x="120" y="96" fill="#b9d7ff" fontSize="26" fontWeight="700" textAnchor="middle">76</text>
              <rect x="94" y="146" width="20" height="6" rx="3" fill="#fff" opacity=".7" />
              <rect x="126" y="146" width="20" height="6" rx="3" fill="#fff" opacity=".7" />
            </g>
          </>
        )}
      </svg>
      <span className="art-label">{product.category}</span>
    </div>
  );
}
