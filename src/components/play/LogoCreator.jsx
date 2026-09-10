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

export default function LogoCreator({ onChange }) {
  const [shape, setShape] = useState("circle");
  const [outerColor, setOuterColor] = useState("#1e293b");
  const [innerColor, setInnerColor] = useState("#38bdf8");

  useEffect(() => {
    onChange(generateLogoSvg(shape, outerColor, innerColor));
  }, [shape, outerColor, innerColor]);

  return (
    <div className="flex flex-col gap-4 bg-neutral-900 p-4 rounded-lg border border-neutral-800">
      <h3 className="text-white font-semibold text-sm">Escudo de tu Equipo</h3>
      
      <div className="flex gap-4 items-center justify-center">
        <div className="w-20 h-20 bg-neutral-950 p-2 rounded border border-neutral-800 flex items-center justify-center">
          <img src={generateLogoSvg(shape, outerColor, innerColor)} className="w-16 h-16 object-contain" alt="Logo preview" />
        </div>
        
        <div className="flex flex-col gap-3">
          {/* Forma */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 w-12">Forma:</span>
            <div className="flex bg-neutral-950 rounded border border-neutral-800">
              <button 
                onClick={() => setShape("circle")}
                className={`p-1.5 ${shape === 'circle' ? 'bg-amber-600' : 'hover:bg-neutral-800'}`}
              >
                <div className="w-4 h-4 rounded-full border-2 border-white"></div>
              </button>
              <button 
                onClick={() => setShape("square")}
                className={`p-1.5 ${shape === 'square' ? 'bg-amber-600' : 'hover:bg-neutral-800'}`}
              >
                <div className="w-4 h-4 border-2 border-white rounded-[2px]"></div>
              </button>
              <button 
                onClick={() => setShape("triangle")}
                className={`p-1.5 ${shape === 'triangle' ? 'bg-amber-600' : 'hover:bg-neutral-800'}`}
              >
                {/* Triangulo CSS rapido */}
                <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-white"></div>
              </button>
            </div>
          </div>
          
          {/* Colores */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 w-12">Principal:</span>
            <input 
              type="color" 
              value={outerColor}
              onChange={(e) => setOuterColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-neutral-950 border border-neutral-800"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 w-12">Detalle:</span>
            <input 
              type="color" 
              value={innerColor}
              onChange={(e) => setInnerColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-neutral-950 border border-neutral-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
