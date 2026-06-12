import React, { useState, useRef, useMemo, useEffect } from "react";

function hexPoints(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 2;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

const PALETTE = [
  "#4ade80",
  "#f87171",
  "#60a5fa",
  "#fbbf24",
  "#a78bfa",
  "#4ADEDE"
];

export default function HexGrid() {
  const baseSize = 20;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [colors, setColors] = useState({});
  const [hovered, setHovered] = useState(null);
  const [brushSize, setBrushSize] = useState(1);
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);

  const lastTouchDist = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const size = baseSize * zoom;

  const axialToPixel = (q, r) => {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * 1.5 * r;
    return { x, y };
  };

  useEffect(() => {
    const range = 40;
    const innerRadius = 17;
    const outerRings = 5;
    const initial = {};

    for (let q = -range; q <= range; q++) {
      for (let r = -range; r <= range; r++) {
        const s = -q - r;
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));

        if (dist <= innerRadius) {
          initial[`${q},${r}`] = "#f87171";
        }

        if (dist > range - outerRings && dist <= range) {
          initial[`${q},${r}`] = "#60a5fa";
        }
      }
    }

    const extraRed = [
      [0,-19],[1,-19],[2,-19],[3,-19],
      [-1,-18],[0,-18],[1,-18],[2,-18],[3,-18],
      [-2,-17],[-1,-17],
      [-3,-16],[-2,-16],
      [-3,-15],
      [18,-3],[19,-3],[18,-2],[19,-2],[18,-1],[19,-1],[18,0],[19,0],
      [17,1],[18,1],[16,2],[17,2],[15,3],[16,3],
      [-18,15],[-19,16],[-18,16],[-19,17],[-18,17],[-19,18],[-18,18],
      [-17,18],[-16,18],[-15,18],[-19,19],
      [-18,19],[-17,19],[-16,19]
    ];
    extraRed.forEach(([q, r]) => {
      initial[`${q},${r}`] = "#f87171";
    });

    setColors(initial);
  }, []);

  const getBrushCells = (q, r, radius) => {
    const results = [];
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const ds = -dq - dr;
        if (Math.abs(ds) <= radius) {
          results.push([q + dq, r + dr]);
        }
      }
    }
    return results;
  };

  const paintCells = (cells, color) => {
    setColors((prev) => {
      const updated = { ...prev };
      cells.forEach(([q, r]) => {
        updated[`${q},${r}`] = color;
      });
      return updated;
    });
  };

  const eraseCells = (cells) => {
    setColors((prev) => {
      const updated = { ...prev };
      cells.forEach(([q, r]) => {
        delete updated[`${q},${r}`];
      });
      return updated;
    });
  };

  const handleClick = (key) => {
    if (longPressTriggered.current) return;
    const [q, r] = key.split(",").map(Number);
    const cells = getBrushCells(q, r, brushSize - 1);
    paintCells(cells, selectedColor);
  };

  const handleRightClick = (e, key) => {
    e.preventDefault();
    const [q, r] = key.split(",").map(Number);
    const cells = getBrushCells(q, r, brushSize - 1);
    eraseCells(cells);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.3, Math.min(3, z + delta)));
  };

  const handleMouseDown = (e) => {
    setDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setDragging(false);

  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e, key) => {
    longPressTriggered.current = false;

    if (e.touches.length === 1) {
      setDragging(true);
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });

      longPressTimer.current = setTimeout(() => {
        const [q, r] = key.split(",").map(Number);
        const cells = getBrushCells(q, r, brushSize - 1);
        eraseCells(cells);
        longPressTriggered.current = true;
      }, 500);
    }

    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDistance(e.touches);
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = (e) => {
    clearTimeout(longPressTimer.current);

    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - lastPos.x;
      const dy = e.touches[0].clientY - lastPos.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }

    if (e.touches.length === 2) {
      const newDist = getTouchDistance(e.touches);
      if (lastTouchDist.current) {
        const delta = (newDist - lastTouchDist.current) * 0.005;
        setZoom((z) => Math.max(0.3, Math.min(3, z + delta)));
      }
      lastTouchDist.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    lastTouchDist.current = null;
    clearTimeout(longPressTimer.current);
  };

  const counts = useMemo(() => {
    const map = {};
    Object.values(colors).forEach((c) => {
      map[c] = (map[c] || 0) + 1;
    });
    return map;
  }, [colors]);

  const range = 40;
  const hexagons = [];

  for (let q = -range; q <= range; q++) {
    for (let r = -range; r <= range; r++) {
      const s = -q - r;
      if (Math.abs(s) > range) continue;

      const { x, y } = axialToPixel(q, r);
      const key = `${q},${r}`;

      hexagons.push(
        <polygon
          key={key}
          points={hexPoints(x, y, size)}
          fill={colors[key] || "#e5e7eb"}
          stroke="#374151"
          strokeWidth="1"
          onClick={() => handleClick(key)}
          onContextMenu={(e) => handleRightClick(e, key)}
          onTouchStart={(e) => handleTouchStart(e, key)}
          onMouseEnter={() => setHovered({ q, r })}
          onMouseLeave={() => setHovered(null)}
        />
      );
    }
  }

  return (
    <div
      className="w-full h-screen bg-gray-100 relative touch-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm">
        {hovered ? `q: ${hovered.q}, r: ${hovered.r}` : "Touch or hover a hex"}
      </div>

      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
        <div className="mb-2">Colors</div>
        <div className="flex gap-2 mb-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              style={{ background: c }}
              className={`w-6 h-6 rounded ${selectedColor === c ? "ring-2 ring-black" : ""}`}
            />
          ))}
        </div>

        <div className="space-y-1">
          {Object.entries(counts).map(([color, count]) => (
            <div key={color} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: color }} />
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-16 left-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
        <div className="mb-1">Brush size: {brushSize}</div>
        <input
          type="range"
          min="1"
          max="5"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      <svg
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${offset.x}, ${offset.y})`}>
          {hexagons}
        </g>
      </svg>
    </div>
  );
}
