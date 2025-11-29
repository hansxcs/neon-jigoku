
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { createSketch } from '../game/sketch.js';
import { GameState } from '../types.js';

const GameCanvas = ({ setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo, gameState, selectedBoss, triggerShieldRef, setPlayerStatus, bulletSpeedRef }) => {
  const containerRef = useRef(null);
  const p5Instance = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Always use full window dimensions for maximum responsiveness
    const targetW = window.innerWidth;
    const targetH = window.innerHeight;

    // Create the p5 instance with dynamic dimensions
    const sketch = createSketch(
        setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo, 
        triggerShieldRef, setPlayerStatus, bulletSpeedRef, 
        targetW, targetH
    );
    const myP5 = new p5(sketch, containerRef.current);
    p5Instance.current = myP5;

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

  // Always full screen, no borders
  const containerClasses = "w-full h-full bg-black overflow-hidden";

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
