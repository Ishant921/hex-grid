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
  const [hideUI, setHideUI] = useState(false);

  const lastTouchDist = useRef(null);

  const size = baseSize * zoom;

  useEffect(() => {
    try {
      localStorage.setItem("hex-grid-colors", JSON.stringify(colors));
    } catch {}
  }, [colors]);

  const axialToPixel = (q, r, hexSize) => {
    const x = hexSize * Math.sqrt(3) * (q + r / 2);
    const y = hexSize * 1.5 * r;
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
    setExporting(true);
    await new Promise((res) => setTimeout(res, 50));

    try {
      const exportSize = 10;
      const range = 40;
      const padding = 40;

      // Calculate bounds
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      for (let q = -range; q <= range; q++) {
        for (let r = -range; r <= range; r++) {
          const s = -q - r;
          if (Math.abs(s) > range) continue;
          const { x, y } = axialToPixel(q, r, exportSize);
          minX = Math.min(minX, x - exportSize);
          maxX = Math.max(maxX, x + exportSize);
          minY = Math.min(minY, y - exportSize);
          maxY = Math.max(maxY, y + exportSize);
        }
      }

      const gridW = maxX - minX + padding * 2;
      const gridH = maxY - minY + padding * 2;
      const offsetX = -minX + padding;
      const offsetY = -minY + padding;

      // Build SVG string
      let hexSVG = "";
      for (let q = -range; q <= range; q++) {
        for (let r = -range; r <= range; r++) {
          const s = -q - r;
          if (Math.abs(s) > range) continue;
          const { x, y } = axialToPixel(q, r, exportSize);
          const key = `${q},${r}`;
          const fill = colors[key] || "#e5e7eb";

          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 2;
            const px = x + offsetX + exportSize * Math.cos(angle);
            const py = y + offsetY + exportSize * Math.sin(angle);
            pts.push(`${px},${py}`);
          }

          hexSVG += `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="#374151" stroke-width="0.5"/>`;
        }
      }

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${gridW}" height="${gridH}">
          <rect width="100%" height="100%" fill="#f3f4f6"/>
          ${hexSVG}
        </svg>
      `;

      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = gridW;
        canvas.height = gridH;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const link = document.createElement("a");
        link.download = "svs-plan.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        setExporting(false);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Export failed. Try again.");
        setExporting(false);
      };

      img.src = url;
    } catch (e) {
      alert("Export failed. Try again.");
      setExporting(false);
    }
  };

  const handleHideUI = () => {
    setHideUI(true);
    setTimeout(() => setHideUI(false), 4000);
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

      const { x, y } = axialToPixel(q, r, size);
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
      className="w-full h-screen bg-gray-100 relative touch-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {!hideUI && (
        <>
          <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm">
            {hovered ? `q: ${hovered.q}, r: ${hovered.r}` : "Touch or hover a hex"}
          </div>

          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="absolute top-4 left-48 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
          >
            ↩ Undo
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="absolute top-4 left-64 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
          >
            {exporting ? "..." : "📷"}
          </button>

          <button
            onClick={handleHideUI}
            className="absolute top-4 left-80 bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm"
          >
            🙈
          </button>

          <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
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

          <div className="absolute top-16 left-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm">
            <div className="mb-1">Brush: {brushSize}</div>
            <input
              type="range"
              min="1"
              max="5"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </div>
        </>
      )}

      {exporting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 px-6 py-4 rounded-xl shadow text-sm font-semibold">
            Generating image...
          </div>
        </div>
      )}

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
