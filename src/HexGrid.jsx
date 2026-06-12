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
  return (
    <div>
      <h1>HEX GRID LOADED 🚀</h1>
    </div>
  );
}
