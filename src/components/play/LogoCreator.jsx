"use client";
import { useState, useEffect } from "react";

export function generateLogoSvg(shape, outerColor, innerColor) {
  let svgContent = '';

  if (shape === 'circle') {
    svgContent = `
      <circle cx="50" cy="50" r="50" fill="${outerColor}" />
      <circle cx="50" cy="50" r="25" fill="${innerColor}" />
    `;
  } else if (shape === 'square') {
    svgContent = `
      <rect width="100" height="100" fill="${outerColor}" rx="10" />
      <rect x="25" y="25" width="50" height="50" fill="${innerColor}" rx="5" />
    `;
  } else if (shape === 'triangle') {
    svgContent = `
      <polygon points="50,5 95,95 5,95" fill="${outerColor}" />
      <polygon points="50,35 75,85 25,85" fill="${innerColor}" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svgContent}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SHAPES = [
  { id: "circle", label: "Circle", icon: <circle cx="8" cy="8" r="6" /> },
  { id: "square", label: "Square", icon: <rect x="2" y="2" width="12" height="12" rx="2" /> },
  { id: "triangle", label: "Triangle", icon: <path d="M8 2l6.5 12h-13z" /> },
];

export default function LogoCreator({ onChange, onColorsChange }) {
  const [shape, setShape] = useState("circle");
  const [outerColor, setOuterColor] = useState("#1e293b");
  const [innerColor, setInnerColor] = useState("#38bdf8");

  useEffect(() => {
    onChange(generateLogoSvg(shape, outerColor, innerColor));
    onColorsChange?.([outerColor, innerColor]);
  }, [shape, outerColor, innerColor, onChange, onColorsChange]);

  return (
    <fieldset className="flex items-center gap-6">
      <legend className="label">Crest</legend>
      <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-raised p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={generateLogoSvg(shape, outerColor, innerColor)} className="h-full w-full object-contain" alt="Crest preview" />
      </span>
      <div className="grid gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Shape">
          {SHAPES.map(s => (
            <button key={s.id} type="button" aria-label={s.label} aria-pressed={shape === s.id} onClick={() => setShape(s.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${shape === s.id ? "bg-ink text-black" : "bg-raised text-ink-2 hover:bg-control"}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{s.icon}</svg>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-ink-2">
          <input type="color" value={outerColor} onChange={e => setOuterColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-md border border-rule-strong bg-raised" />
          Main color
        </label>
        <label className="flex items-center gap-3 text-ink-2">
          <input type="color" value={innerColor} onChange={e => setInnerColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-md border border-rule-strong bg-raised" />
          Detail color
        </label>
      </div>
    </fieldset>
  );
}
