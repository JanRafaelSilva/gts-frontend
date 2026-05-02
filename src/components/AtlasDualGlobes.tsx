import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { feature } from "topojson-client";

import land110m from "world-atlas/land-110m.json";
import countries110m from "world-atlas/countries-110m.json";

import type { Transaction } from "../types";

interface AtlasDualGlobesProps {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  futureMode: boolean;
  onSelectTransaction: (transaction: Transaction | null) => void;
}

type LonLat = [number, number];

const BLACK = "#000000";
const WHITE = "#ffffff";
const MAIN_RADIUS = 1.1;
const MINI_RADIUS = 0.82;

const CATEGORY_ACCENTS: Record<string, string> = {
  Economy: "#6ee7c8",
  Politics: "#86a6ff",
  Military: "#ff7f96",
  Technology: "#9ce7b5",
  Climate: "#ffd166"
};

const WESTERN_ROTATION = THREE.MathUtils.degToRad(82);
const EASTERN_ROTATION = THREE.MathUtils.degToRad(-72);
const SOUTH_POLAR_ROTATION = THREE.MathUtils.degToRad(180);
const NORTH_POLAR_ROTATION = 0;

const MOUNTAIN_RIDGES: LonLat[][] = [
  [[-150, 61], [-142, 58], [-134, 54], [-126, 49], [-118, 43], [-111, 37], [-107, 31]],
  [[-79, 8], [-77, 0], [-75, -10], [-73, -20], [-71, -31], [-70, -42], [-70, -52]],
  [[-11, 31], [-4, 32], [2, 33], [9, 34]],
  [[5, 44], [10, 46], [15, 47], [19, 46]],
  [[68, 35], [76, 35], [84, 31], [92, 29], [101, 27]],
  [[28, 11], [31, 2], [34, -8], [37, -18], [40, -28]],
  [[129, 31], [135, 35], [141, 40], [145, 44]],
  [[36, 43], [48, 43], [58, 42], [68, 42]]
];

function lonLatToVector3(lon: number, lat: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(lat);
  const theta = THREE.MathUtils.degToRad(lon);

  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = radius * Math.cos(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

function toSpherePolyline(points: LonLat[], radius: number, offset = 0.002) {
  return points.map(([lon, lat]) => lonLatToVector3(lon, lat, radius + offset));
}

function collectCoordinateLines(geo: any): LonLat[][] {
  const lines: LonLat[][] = [];

  const walkGeometry = (geometry: any) => {
    if (!geometry) return;

    if (geometry.type === "Polygon") {
      geometry.coordinates.forEach((ring: LonLat[]) => lines.push(ring));
      return;
    }

    if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon: LonLat[][]) => {
        polygon.forEach((ring: LonLat[]) => lines.push(ring));
      });
      return;
    }

    if (geometry.type === "LineString") {
      lines.push(geometry.coordinates as LonLat[]);
      return;
    }

    if (geometry.type === "MultiLineString") {
      geometry.coordinates.forEach((line: LonLat[]) => lines.push(line));
    }
  };

  if (geo.type === "FeatureCollection") {
    geo.features.forEach((entry: any) => walkGeometry(entry.geometry));
  } else if (geo.type === "Feature") {
    walkGeometry(geo.geometry);
  } else {
    walkGeometry(geo);
  }

  return lines;
}

function createGraticule(stepLat = 15, stepLon = 15): LonLat[][] {
  const lines: LonLat[][] = [];

  for (let lat = -75; lat <= 75; lat += stepLat) {
    const row: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      row.push([lon, lat]);
    }
    lines.push(row);
  }

  for (let lon = -180; lon < 180; lon += stepLon) {
    const column: LonLat[] = [];
    for (let lat = -90; lat <= 90; lat += 4) {
      column.push([lon, lat]);
    }
    lines.push(column);
  }

  return lines;
}

function createEngravingMaterial(radius: number) {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uRadius: { value: radius }
    },
    vertexShader: `
      varying vec3 vNormalDir;
      varying vec3 vWorldPos;

      void main() {
        vNormalDir = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormalDir;
      varying vec3 vWorldPos;
      uniform float uRadius;

      float bandLine(float value, float scale, float width) {
        float wave = abs(sin(value * scale));
        return 1.0 - smoothstep(0.0, width, wave);
      }

      void main() {
        vec3 n = normalize(vNormalDir);
        float lon = atan(n.z, n.x);
        float lat = asin(clamp(n.y, -1.0, 1.0));

        float majorLon = bandLine(lon, 12.0, 0.038);
        float majorLat = bandLine(lat, 12.0, 0.038);
        float minorLon = bandLine(lon, 36.0, 0.016);
        float minorLat = bandLine(lat, 36.0, 0.016);

        float hatchA = bandLine(n.x + n.y * 0.92, 62.0, 0.055);
        float hatchB = bandLine(n.z - n.y * 0.88, 74.0, 0.055);
        float hatchC = bandLine(n.x - n.z * 0.65, 96.0, 0.045);

        float polarFade = smoothstep(0.02, 0.9, abs(n.y));
        float hatch = max(hatchA, max(hatchB, hatchC)) * 0.13 * polarFade;

        float ring = smoothstep(0.68, 1.0, 1.0 - abs(n.z)) * 0.04;
        float grid = max(max(majorLon, majorLat) * 0.52, max(minorLon, minorLat) * 0.18);
        float ink = clamp(grid + hatch + ring, 0.0, 1.0);

        gl_FragColor = vec4(vec3(ink), 1.0);
      }
    `
  });
}

function MarkerGlyph({
  transaction,
  selected,
  radius,
  onSelect
}: {
  transaction: Transaction;
  selected: boolean;
  radius: number;
  onSelect: (transaction: Transaction) => void;
}) {
  const [lat, lng] = transaction.loc;
  const position = lonLatToVector3(lng, lat, radius + 0.03 + transaction.intensity * 0.003);
  const accent = CATEGORY_ACCENTS[transaction.type] ?? WHITE;
  const size = 0.028 + transaction.intensity * 0.003;

  return (
    <group position={position} onClick={() => onSelect(transaction)}>
      <mesh>
        <ringGeometry args={[size * 0.7, size, 28]} />
        <meshBasicMaterial color={WHITE} transparent opacity={selected ? 1 : 0.82} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[size * 2.1, 0.008]} />
        <meshBasicMaterial color={WHITE} transparent opacity={0.95} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <planeGeometry args={[size * 2.1, 0.008]} />
        <meshBasicMaterial color={WHITE} transparent opacity={0.95} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 0.22, 12, 12]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      {selected && (
        <Html center position={[0, size + 0.12, 0]}>
          <div className="marker-tooltip">
            <strong>{transaction.type}</strong>
            <span>{transaction.region}</span>
            <p>{transaction.desc}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function GlobeWireLayer({
  radius,
  rotationY,
  transactions,
  selectedTransaction,
  onSelectTransaction,
  controlsEnabled = true
}: {
  radius: number;
  rotationY: number;
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  onSelectTransaction: (transaction: Transaction) => void;
  controlsEnabled?: boolean;
}) {
  const material = useMemo(() => createEngravingMaterial(radius), [radius]);

  const coastlines = useMemo(() => {
    const geo = feature(land110m as any, (land110m as any).objects.land);
    return collectCoordinateLines(geo).map((line) => toSpherePolyline(line, radius, 0.006));
  }, [radius]);

  const borders = useMemo(() => {
    const geo = feature(countries110m as any, (countries110m as any).objects.countries);
    return collectCoordinateLines(geo).map((line) => toSpherePolyline(line, radius, 0.0045));
  }, [radius]);

  const graticule = useMemo(() => {
    return createGraticule(15, 15).map((line) => toSpherePolyline(line, radius, 0.002));
  }, [radius]);

  const mountainLines = useMemo(() => {
    return MOUNTAIN_RIDGES.map((line) => toSpherePolyline(line, radius, 0.0075));
  }, [radius]);

  return (
    <>
      <ambientLight intensity={1} />
      <group rotation={[0, rotationY, 0]}>
        <mesh>
          <sphereGeometry args={[radius, 96, 96]} />
          <primitive object={material} attach="material" />
        </mesh>

        {graticule.map((points, index) => (
          <Line
            key={`graticule-${radius}-${index}`}
            points={points}
            color={WHITE}
            transparent
            opacity={0.24}
            lineWidth={0.8}
          />
        ))}

        {borders.map((points, index) => (
          <Line
            key={`border-${radius}-${index}`}
            points={points}
            color={WHITE}
            transparent
            opacity={0.16}
            lineWidth={0.42}
          />
        ))}

        {coastlines.map((points, index) => (
          <Line
            key={`coast-${radius}-${index}`}
            points={points}
            color={WHITE}
            transparent
            opacity={0.97}
            lineWidth={1.15}
          />
        ))}

        {mountainLines.map((points, index) => (
          <Line
            key={`mountain-${radius}-${index}`}
            points={points}
            color={WHITE}
            transparent
            opacity={0.5}
            lineWidth={0.84}
          />
        ))}

        {transactions.map((transaction) => (
          <MarkerGlyph
            key={`${radius}-${transaction.id}`}
            transaction={transaction}
            selected={selectedTransaction?.id === transaction.id}
            radius={radius}
            onSelect={onSelectTransaction}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={controlsEnabled}
        enableRotate
        rotateSpeed={0.72}
        zoomSpeed={0.6}
        dampingFactor={0.08}
        enableDamping
        minDistance={radius * 1.9}
        maxDistance={radius * 4.5}
      />
    </>
  );
}

function GlobeViewport({
  title,
  subtitle,
  radius,
  rotationY,
  transactions,
  selectedTransaction,
  onSelectTransaction,
  mini = false
}: {
  title: string;
  subtitle: string;
  radius: number;
  rotationY: number;
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  onSelectTransaction: (transaction: Transaction) => void;
  mini?: boolean;
}) {
  return (
    <div className={`atlas-viewport ${mini ? "mini" : "main"}`}>
      <div className="atlas-viewport-label">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Canvas camera={{ position: [0, 0, radius * 3.1], fov: mini ? 32 : 28 }}>
        <color attach="background" args={[BLACK]} />
        <GlobeWireLayer
          radius={radius}
          rotationY={rotationY}
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
          controlsEnabled
        />
      </Canvas>
    </div>
  );
}

function PlateProjection({
  transactions,
  selectedTransaction,
  onSelectTransaction
}: {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  onSelectTransaction: (transaction: Transaction) => void;
}) {
  function project([lat, lng]: [number, number]) {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  }

  const meridians = Array.from({ length: 13 }, (_, index) => index * (100 / 12));
  const parallels = Array.from({ length: 7 }, (_, index) => index * (100 / 6));

  return (
    <div className="atlas-plate">
      <div className="atlas-viewport-label">
        <strong>Mercator Plate</strong>
        <span>Auxiliary reference</span>
      </div>
      <svg viewBox="0 0 100 100" className="atlas-plate-svg" aria-hidden="true">
        <rect x="2" y="2" width="96" height="96" fill="#000000" stroke="#ffffff" strokeOpacity="0.24" />
        {meridians.map((x) => (
          <line key={`m-${x}`} x1={x + 2} y1={2} x2={x + 2} y2={98} stroke="#ffffff" strokeOpacity="0.16" strokeWidth="0.35" />
        ))}
        {parallels.map((y) => (
          <line key={`p-${y}`} x1={2} y1={y + 2} x2={98} y2={y + 2} stroke="#ffffff" strokeOpacity="0.16" strokeWidth="0.35" />
        ))}
        <path
          d="M11 32 L24 26 L33 29 L38 37 L35 44 L29 46 L24 53 L18 49 L12 42 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.55"
          strokeOpacity="0.9"
        />
        <path
          d="M41 27 L52 24 L63 28 L72 35 L71 44 L64 49 L58 56 L49 54 L43 45 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.55"
          strokeOpacity="0.9"
        />
        <path
          d="M72 31 L80 30 L86 36 L88 45 L84 54 L77 57 L73 49 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.55"
          strokeOpacity="0.9"
        />
        <path
          d="M49 62 L58 63 L64 68 L61 76 L52 75 L46 69 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.55"
          strokeOpacity="0.9"
        />

        {transactions.map((transaction) => {
          const { x, y } = project(transaction.loc);
          const selected = selectedTransaction?.id === transaction.id;
          const accent = CATEGORY_ACCENTS[transaction.type] ?? WHITE;
          return (
            <g key={`plate-${transaction.id}`} onClick={() => onSelectTransaction(transaction)} className="atlas-plate-point">
              <circle cx={x} cy={y} r={selected ? 2.1 : 1.45} fill="none" stroke="#ffffff" strokeWidth="0.6" />
              <circle cx={x} cy={y} r={0.8} fill={accent} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AtlasDualGlobes({
  transactions,
  selectedTransaction,
  futureMode,
  onSelectTransaction
}: AtlasDualGlobesProps) {
  return (
    <div className="atlas-dual-shell">
      <div className="atlas-overlay-row">
        <div className="overlay-chip">{futureMode ? "Future_A branch active" : "Base_State live"}</div>
        <div className="overlay-chip">{transactions.length} plotted transactions</div>
      </div>

      <div className="atlas-main-row">
        <GlobeViewport
          title="Western Hemisphere"
          subtitle="Independent orbit"
          radius={MAIN_RADIUS}
          rotationY={WESTERN_ROTATION}
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
        />
        <GlobeViewport
          title="Eastern Hemisphere"
          subtitle="Independent orbit"
          radius={MAIN_RADIUS}
          rotationY={EASTERN_ROTATION}
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
        />
      </div>

      <div className="atlas-helper-row">
        <GlobeViewport
          title="Southern Polar"
          subtitle="Auxiliary globe"
          radius={MINI_RADIUS}
          rotationY={SOUTH_POLAR_ROTATION}
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
          mini
        />

        <PlateProjection
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
        />

        <GlobeViewport
          title="Northern Polar"
          subtitle="Auxiliary globe"
          radius={MINI_RADIUS}
          rotationY={NORTH_POLAR_ROTATION}
          transactions={transactions}
          selectedTransaction={selectedTransaction}
          onSelectTransaction={onSelectTransaction}
          mini
        />
      </div>
    </div>
  );
}
