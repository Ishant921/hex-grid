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
const LABEL_TOOL = "LABEL_TOOL";

const DEFAULT_LEGEND = {
  "#4ade80": "Alliance 1",
  "#f87171": "HQ Zone",
  "#60a5fa": "Border",
  "#fbbf24": "Alliance 2",
  "#a78bfa": "Alliance 3",
  "#4ADEDE": "Alliance 4",
};

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
  const [labels, setLabels] = useState(() => {
    try {
      const saved = localStorage.getItem("hex-grid-labels");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [legend, setLegend] = useState(() => {
    try {
      const saved = localStorage.getItem("hex-grid-legend");
      return saved ? JSON.parse(saved) : { ...DEFAULT_LEGEND };
    } catch {
      return { ...DEFAULT_LEGEND };
    }
  });
  const [hovered, setHovered] = useState(null);
  const [brushSize, setBrushSize] = useState(1);
  const [selectedTool, setSelectedTool] = useState(PALETTE[0]);
  const [history, setHistory] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [labelInput, setLabelInput] = useState(null);
  const [labelText, setLabelText] = useState("");
  const [editingLegend, setEditingLegend] = useState(null);
  const [editingLegendText, setEditingLegendText] = useState("");
  const [showReset, setShowReset] = useState(false);

  const lastTouchDist = useRef(null);
  const labelInputRef = useRef(null);

  const size = baseSize * zoom;

  useEffect(() => {
    try {
      localStorage.setItem("hex-grid-colors", JSON.stringify(colors));
    } catch {}
  }, [colors]);

  useEffect(() => {
    try {
      localStorage.setItem("hex-grid-labels", JSON.stringify(labels));
    } catch {}
  }, [labels]);

  useEffect(() => {
    try {
      localStorage.setItem("hex-grid-legend", JSON.stringify(legend));
    } catch {}
  }, [legend]);

  useEffect(() => {
    if (labelInput && labelInputRef.current) {
      labelInputRef.current.focus();
    }
  }, [labelInput]);

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
    if (selectedTool === LABEL_TOOL) {
      const key = `${q},${r}`;
      setLabelInput(key);
      setLabelText(labels[key] || "");
      return;
    }

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

  const handleLabelSubmit = () => {
    if (!labelInput) return;
    setLabels((prev) => {
      const updated = { ...prev };
      if (labelText.trim() === "") {
        delete updated[labelInput];
      } else {
        updated[labelInput] = labelText.trim();
      }
      return updated;
    });
    setLabelInput(null);
    setLabelText("");
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

  const handleReset = () => {
    setColors({ ...PROTECTED });
    setLabels({});
    setHistory([]);
    setShowReset(false);
  };

  const handleExport = async () => {
    setExporting(true);
    await new Promise((res) => setTimeout(res, 50));

    try {
      const exportSize = 20;
      const scale = 2;
      const range = 40;
      const padding = 40;

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

      let hexSVG = "";
      for (let q = -range; q <= range; q++) {
        for (let r = -range; r <= range; r++) {
          const s = -q - r;
          if (Math.abs(s) > range) continue;
          const { x, y } = axialToPixel(q, r, exportSize);
          const key = `${q},${r}`;
          const fill = colors[key] || "#e5e7eb";
          const label = labels[key];

          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 2;
            const px = x + offsetX + exportSize * Math.cos(angle);
            const py = y + offsetY + exportSize * Math.sin(angle);
            pts.push(`${px},${py}`);
          }

          hexSVG += `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="#374151" stroke-width="0.5"/>`;

          if (label) {
            hexSVG += `<text x="${x + offsetX}" y="${y + offsetY + 4}" text-anchor="middle" font-size="8" font-family="Arial" font-weight="bold" fill="#1f2937">${label}</text>`;
          }
        }
      }

      // Legend in export
      let legendSVG = "";
      const legendEntries = Object.entries(legend);
      const usedColors = new Set(Object.values(colors));
      const visibleLegend = legendEntries.filter(([color]) => usedColors.has(color));
      visibleLegend.forEach(([color, name], i) => {
        const lx = padding;
        const ly = gridH - padding - (visibleLegend.length - i - 1) * 20;
        legendSVG += `<rect x="${lx}" y="${ly - 10}" width="14" height="14" fill="${color}" rx="2"/>`;
        legendSVG += `<text x="${lx + 20}" y="${ly}" font-size="12" font-family="Arial" fill="#1f2937">${name}</text>`;
      });

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${gridW}" height="${gridH}">
          <rect width="100%" height="100%" fill="#f3f4f6"/>
          ${hexSVG}
          ${legendSVG}
        </svg>
      `;

      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = gridW * scale;
        canvas.height = gridH * scale;
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
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
      const label = labels[key];

      hexagons.push(
        <g key={key}>
          <polygon
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
          {label && (
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={size * 0.4}
              fontFamily="Arial"
              fontWeight="bold"
              fill="#1f2937"
              pointerEvents="none"
            >
              {label}
            </text>
          )}
        </g>
      );
    }
  }

  return (
    <div
      className="w-full h-screen bg-gray-100 relative touch-none overflow-hidden"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {!hideUI && (
        <>
          {/* Top bar */}
          <div className="absolute top-4 left-4 right-4 flex gap-2 flex-wrap">
            <div className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm">
              {hovered ? `q: ${hovered.q}, r: ${hovered.r}` : "Hover a hex"}
            </div>
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
            >
              ↩ Undo
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm disabled:opacity-40"
            >
              {exporting ? "..." : "📷"}
            </button>
            <button
              onClick={handleHideUI}
              className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm"
            >
              🙈
            </button>
            <button
              onClick={() => setShowReset(true)}
              className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl shadow text-sm text-red-500"
            >
              🗑 Reset
            </button>
          </div>

          {/* Tools panel */}
          <div className="absolute top-16 right-4 bg-white/80 backdrop-blur px-4 py-3 rounded-xl shadow text-sm max-h-[70vh] overflow-y-auto">
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
              <button
                onClick={() => setSelectedTool(LABEL_TOOL)}
                className={`w-7 h-7 rounded border-2 border-gray-400 bg-white text-xs font-bold ${selectedTool === LABEL_TOOL ? "ring-2 ring-black scale-110" : ""}`}
              >
                T
              </button>
            </div>

            <div className="mb-2 font-semibold">Legend</div>
            <div className="space-y-1">
              {PALETTE.map((color) => (
                <div key={color} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: color }} />
                  {editingLegend === color ? (
                    <input
                      autoFocus
                      className="text-xs border rounded px-1 py-0.5 w-24"
                      value={editingLegendText}
                      onChange={(e) => setEditingLegendText(e.target.value)}
                      onBlur={() => {
                        setLegend((prev) => ({ ...prev, [color]: editingLegendText }));
                        setEditingLegend(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setLegend((prev) => ({ ...prev, [color]: editingLegendText }));
                          setEditingLegend(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="text-xs cursor-pointer hover:underline"
                      onClick={() => {
                        setEditingLegend(color);
                        setEditingLegendText(legend[color] || "");
                      }}
                    >
                      {legend[color] || "Tap to name"}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{counts[color] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brush size */}
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

      {/* Label input popup */}
      {labelInput && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 w-72">
            <div className="text-sm font-semibold mb-3">Add Label</div>
            <input
              ref={labelInputRef}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Type label..."
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLabelSubmit(); }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleLabelSubmit}
                className="flex-1 bg-blue-500 text-white rounded-lg py-2 text-sm font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => { setLabelInput(null); setLabelText(""); }}
                className="flex-1 bg-gray-100 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirm popup */}
      {showReset && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 w-72">
            <div className="text-sm font-semibold mb-2">Reset map?</div>
            <div className="text-xs text-gray-500 mb-4">This will clear all your painted hexes and labels. Protected zones stay.</div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-semibold"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowReset(false)}
                className="flex-1 bg-gray-100 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
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