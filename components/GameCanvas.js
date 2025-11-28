
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { createSketch } from '../game/sketch.js';
import { GameState } from '../types.js';

const GameCanvas = ({ setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo, gameState, selectedBoss }) => {
  const containerRef = useRef(null);
  const p5Instance = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the p5 instance
    const sketch = createSketch(setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo);
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


  return React.createElement('div', {
    ref: containerRef,
    className: "border-4 border-cyan-500 rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.5)] overflow-hidden"
  });
};

export default GameCanvas;