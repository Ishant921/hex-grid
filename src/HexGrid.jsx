import React, { useState, useRef, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";

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

const ERASER = "ERASER";

function buildInitialColors() {
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

  return initial;
}

const PROTECTED = buildInitialColors();

export default function HexGrid() {
  const baseSize = 20;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [colors, setColors] = useState(() => {
    try {
      const saved = localStorage.getItem("hex-grid-colors");
      return saved ? JSON.parse(saved) : { ...PROTECTED };
    } catch {
      return { ...PROTECTED };
    }
  });
  const [hovered, setHovered] = useState(null);
  const [brushSize, setBrushSize] = useState(1);
  const [selectedTool, setSelectedTool] = useState(PALETTE[0]);
  const [history, setHistory] = useState([]);
  const [exporting, setExporting] = useState(false);

  const lastTouchDist = useRef(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const size = baseSize * zoom;

  useEffect(() => {
    try {
      localStorage.setItem("hex-grid-colors", JSON.stringify(colors));
    } catch {}
  }, [colors]);

  const axialToPixel = (q, r) => {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * 1.5 * r;
    return { x, y };
  };

  const isProtected = (key) => key in PROTECTED;

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

  const applyTool = (q, r) => {
    const cells = getBrushCells(q, r, brushSize - 1);
    const freeCells = cells.filter(([cq, cr]) => !isProtected(`${cq},${cr}`));
    if (freeCells.length === 0) return;

    setColors((prev) => {
      const snapshot = {};
      freeCells.forEach(([cq, cr]) => {
        snapshot[`${cq},${cr}`] = prev[`${cq},${cr}`];
      });
      setHistory((h) => [...h.slice(-49), snapshot]);

      const updated = { ...prev };
      freeCells.forEach(([cq, cr]) => {
        if (selectedTool === ERASER) {
          delete updated[`${cq},${cr}`];
        } else {
          updated[`${cq},${cr}`] = selectedTool;
        }
      });
      return updated;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setColors((prev) => {
      const updated = { ...prev };
      Object.entries(last).forEach(([key, val]) => {
        if (val === undefined) {
          delete updated[key];
        } else {
          updated[key] = val;
        }
      });
      return updated;
    });
  };

  const handleExport = async () => {
    if (!svgRef.current || !containerRef.current) return;
    setExporting(true);

    // Save current offset and zoom
    const prevOffset = { ...offset };
    const prevZoom = zoom;

    // Center the grid
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    setOffset({ x: cw / 2, y: ch / 2 });
    setZoom(0.6);

    // Wait for render
    await new Promise((res) => setTimeout(res, 500));

    try {
      const canvas = await html2canvas(container, {
        useCORS: true,
        backgroundColor: "#f3f4f6",
        ignoreElements: (el) => el.classList.contains("no-export"),
      });

      const link = document.createElement("a");
      link.download = "svs-plan.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      alert("Export failed. Try screenshotting manually.");
    }

    // Restore
    setOffset(prevOffset);
    setZoom(prevZoom);
    setExporting(false);
  };

  const handleClick = (key) => {
    const [q, r] = key.split(",").map(Number);
    applyTool(q, r);
  };

  const handleRightClick = (e) => e.preventDefault();

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
    if (e.touches.length === 1) {
      setDragging(true);
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDistance(e.touches);
    }
  };

  const handleTouchMove = (e) => {
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
          onContextMenu={handleRightClick}
          onTouchStart={(e) => handleTouchStart(e, key)}
          onMouseEnter={() => setHovered({ q, r })}
          onMouseLeave={() => setHovered(null)}
        />
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-screen bg-gray-100 relative touch-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Coordinates */}
      <div className="no-export absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm">
        {hovered ? `q: ${hovered.q}, r: ${hovered.r}` : "Touch or hover a hex"}
      </div>

      {/* Undo button */}
      <button
        onClick={handleUndo}
        disabled={history.length === 0}
        className="no-export absolute top-4 left-48 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
      >
        ↩ Undo
      </button>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="no-export absolute top-4 left-64 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
      >
        {exporting ? "Exporting..." : "📷 Export"}
      </button>

      {/* Tools panel */}
      <div className="no-export absolute top-4 right-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
        <div className="mb-2 font-semibold">Tools</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedTool(c)}
              style={{ background: c }}
              className={`w-7 h-7 rounded ${selectedTool === c ? "ring-2 ring-black scale-110" : ""}`}
            />
          ))}
          <button
            onClick={() => setSelectedTool(ERASER)}
            className={`w-7 h-7 rounded border-2 border-gray-400 bg-white text-xs ${selectedTool === ERASER ? "ring-2 ring-black scale-110" : ""}`}
          >
            ✕
          </button>
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

      {/* Brush size */}
      <div className="no-export top-16 left-4 absolute bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
        <div className="mb-1">Brush: {brushSize}</div>
        <input
          type="range"
          min="1"
          max="5"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${offset.x}, ${offset.y})`}>
          {hexagons}
        </g>
      </svg>

      {exporting && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-lg font-bold">
          Preparing export...
        </div>
      )}
    </div>
  );
}
