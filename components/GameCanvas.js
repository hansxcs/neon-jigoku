
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { createSketch } from '../game/sketch.js';
import { GameState } from '../types.js';

const GameCanvas = ({ setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo, gameState, selectedBoss, triggerShieldRef, setPlayerStatus, bulletSpeedRef }) => {
  const containerRef = useRef(null);
  const p5Instance = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Detect if mobile (simple width check or user agent if needed, width is usually sufficient for responsive layout)
    const isMobile = window.innerWidth < 768; 
    
    // On mobile, use exact window dimensions to fill the screen.
    // On desktop, stick to the fixed arcade resolution.
    const targetW = isMobile ? window.innerWidth : 800;
    const targetH = isMobile ? window.innerHeight : 600;

    // Create the p5 instance with dynamic dimensions
    const sketch = createSketch(
        setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo, 
        triggerShieldRef, setPlayerStatus, bulletSpeedRef, 
        targetW, targetH
    );
    const myP5 = new p5(sketch, containerRef.current);
    p5Instance.current = myP5;

    // Adjust container Aspect Ratio dynamically only for desktop
    if (!isMobile) {
        containerRef.current.style.aspectRatio = `${targetW}/${targetH}`;
    }

    return () => {
      myP5.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
     if (gameState === GameState.PLAYING && p5Instance.current) {
         p5Instance.current.startGame(selectedBoss);
     }
  }, [gameState, selectedBoss]);

  // Dynamic Border/Style classes
  // Mobile: No border, full size. Desktop: Border, rounded.
  const isMobile = window.innerWidth < 768;
  const containerClasses = isMobile 
    ? "w-full h-full bg-black overflow-hidden"
    : "w-full border-4 border-cyan-500 rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.5)] overflow-hidden bg-black";

  return React.createElement('div', {
    ref: containerRef,
    className: containerClasses,
    style: { 
        width: "100%", 
        height: "100%",
        display: "block"
    } 
  });
};

export default GameCanvas;
