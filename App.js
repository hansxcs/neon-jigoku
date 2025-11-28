

import React, { useState, useRef } from 'react';
import htm from 'htm';
import GameCanvas from './components/GameCanvas.js';
import { GameState } from './types.js';

const html = htm.bind(React.createElement);

const App = () => {
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [bossHealth, setBossHealth] = useState(100);
  const [gameState, setGameState] = useState(GameState.MENU);
  const [stage, setStage] = useState(1);
  const [weaponInfo, setWeaponInfo] = useState({ name: 'DEFAULT', level: 1, timer: 0 });
  const [selectedBoss, setSelectedBoss] = useState('RANDOM');
  const [playerStatus, setPlayerStatus] = useState({ shieldCharges: 3, shieldTimer: 0 });
  
  // Bullet Speed Control
  const [bulletSpeed, setBulletSpeed] = useState(1.0);
  const bulletSpeedRef = useRef(1.0);

  // Ref to trigger shield from UI
  const triggerShieldRef = useRef(null);

  const startGame = () => {
    setGameState(GameState.PLAYING);
  };

  const activateShield = () => {
      if (triggerShieldRef.current) triggerShieldRef.current();
  };

  const handleSpeedChange = (e) => {
      const val = parseFloat(e.target.value);
      setBulletSpeed(val);
      bulletSpeedRef.current = val;
  };

  const resetSpeed = () => {
      setBulletSpeed(1.0);
      bulletSpeedRef.current = 1.0;
  };

  const getWeaponClass = (name) => {
    if (name === 'DEFAULT') return 'border-gray-500 text-gray-400';
    if (name === 'SPREAD') return 'border-green-500 text-green-400';
    if (name === 'RAPID') return 'border-yellow-500 text-yellow-400';
    return 'border-purple-500 text-purple-400';
  };

  return html`
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col items-center justify-center font-mono text-white overflow-hidden selection:bg-cyan-500 selection:text-black touch-none select-none">
      
      <!-- HUD -->
      <div className="absolute top-1 w-full max-w-[800px] flex justify-between px-2 z-10 pointer-events-none">
        <div className="flex flex-col gap-0.5 md:gap-1">
          <div className="text-sm md:text-2xl font-bold text-cyan-400 drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">
            SCORE: ${score.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
             <div className="w-16 md:w-48 h-2 md:h-4 bg-gray-900 border border-cyan-700 rounded-sm relative overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-200 ease-out"
                  style=${{ width: `${Math.max(0, health)}%` }}
                />
             </div>
             <span className="text-cyan-200 text-[10px] md:text-base">HP</span>
          </div>
          
          <!-- Weapon Status -->
          <div className="flex items-center gap-2 mt-0.5">
            <div className=${`px-1 py-0.5 rounded text-[9px] md:text-xs font-bold border ${getWeaponClass(weaponInfo.name)}`}>
                ${weaponInfo.name} ${weaponInfo.level}
            </div>
            ${weaponInfo.timer > 0 && html`
                <span className="text-white text-[10px] md:text-sm">${weaponInfo.timer}s</span>
            `}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 md:gap-1 items-end">
          <div className="text-sm md:text-xl font-bold text-pink-500 drop-shadow-[0_0_5px_rgba(255,0,100,0.8)]">
             STAGE ${stage}/5
          </div>
          <div className="flex items-center gap-1 md:gap-2">
             <span className="text-pink-200 text-[10px] md:text-base">BOSS</span>
             <div className="w-20 md:w-64 h-3 md:h-6 bg-gray-900 border border-pink-900 rounded-sm relative overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-l from-pink-500 to-purple-600 transition-all duration-200 ease-out"
                  style=${{ width: `${Math.max(0, bossHealth)}%` }}
                />
             </div>
          </div>
          
          <!-- Shield Status -->
          <div className="flex items-center gap-1 mt-0.5 text-blue-400 font-bold text-[10px] md:text-sm">
             SHIELD: ${playerStatus.shieldCharges}
             ${playerStatus.shieldTimer > 0 && html`<span className="text-white ml-1">(${playerStatus.shieldTimer}s)</span>`}
          </div>
        </div>
      </div>

      <!-- Game Canvas Wrapper - Removed padding on mobile to allow full screen -->
      <div className="relative z-0 w-full h-full flex items-center justify-center p-0 md:p-4">
        <${GameCanvas} 
          setScore=${setScore} 
          setHealth=${setHealth} 
          setBossHealth=${setBossHealth}
          setGameState=${setGameState}
          setStage=${setStage}
          setWeaponInfo=${setWeaponInfo}
          setPlayerStatus=${setPlayerStatus}
          gameState=${gameState}
          selectedBoss=${selectedBoss}
          triggerShieldRef=${triggerShieldRef}
          bulletSpeedRef=${bulletSpeedRef}
        />
      </div>

      <!-- Mobile/Touch Shield Button -->
      ${gameState === GameState.PLAYING && html`
          <div className="absolute bottom-4 right-4 z-20 md:hidden">
              <button 
                  onClick=${activateShield}
                  disabled=${playerStatus.shieldCharges <= 0 || playerStatus.shieldTimer > 0}
                  className=${`w-16 h-16 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-lg active:scale-95 transition-all
                    ${playerStatus.shieldTimer > 0 
                        ? 'bg-blue-900/50 border-blue-600 text-blue-200 animate-pulse' 
                        : playerStatus.shieldCharges > 0 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(50,150,255,0.6)]' 
                            : 'bg-gray-800 border-gray-600 text-gray-500'
                    }`}
              >
                  ${playerStatus.shieldTimer > 0 ? playerStatus.shieldTimer : 'SHIELD'}
              </button>
          </div>
          
          <!-- Desktop Shield Hint -->
          <div className="absolute bottom-4 right-4 z-10 hidden md:block text-gray-500 text-sm pointer-events-none">
             SPACEBAR for Shield
          </div>
      `}

      <!-- Menu / Overlays -->
      ${gameState === GameState.MENU && html`
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-4">
          <div className="flex flex-col items-center p-4 md:p-6 border border-cyan-500/30 bg-black/90 rounded-xl shadow-[0_0_50px_rgba(0,255,255,0.2)] w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-2 md:mb-4 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
              NEON HELL
            </h1>
            
            <!-- Bullet Speed Control -->
            <div className="w-full mb-3 bg-gray-900/80 p-2 rounded border border-gray-700">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-cyan-400 font-bold uppercase">Enemy Speed</label>
                    <span className="text-[10px] font-mono text-white">${bulletSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="range" 
                        min="0.5" 
                        max="3.0" 
                        step="0.1"
                        value=${bulletSpeed} 
                        onInput=${handleSpeedChange}
                        className="w-full accent-cyan-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <button 
                        onClick=${resetSpeed}
                        className="px-2 py-1 text-[9px] bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600"
                    >
                        DEF
                    </button>
                </div>
            </div>

            <div className="w-full mb-3 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Select Target</span>
              <div className="flex gap-1.5 flex-wrap justify-center">
                ${['RANDOM', 'CIRCLE', 'SQUARE', 'TRIANGLE', 'HEART', 'OVAL', 'HEXAGON', 'HOURGLASS', 'MATH'].map(boss => html`
                    <button key=${boss} onClick=${() => setSelectedBoss(boss)} className=${`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${selectedBoss === boss ? 'bg-cyan-900 border-cyan-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                        ${boss}
                    </button>
                `)}
              </div>
            </div>

            <div className="w-full space-y-1 text-[10px] md:text-xs text-gray-400 mb-4 bg-gray-900/50 p-3 rounded text-left">
               <p><span className="text-white">Controls:</span> WASD / Touch to Move</p>
               <p><span className="text-white">Shield:</span> SPACE / Button</p>
               <div className="grid grid-cols-4 gap-1 mt-1 text-[9px] opacity-80">
                 <span className="text-green-400">Spread</span>
                 <span className="text-yellow-400">Rapid</span>
                 <span className="text-purple-400">Homing</span>
                 <span className="text-pink-400">Heal</span>
               </div>
            </div>

            <button 
              onClick=${startGame}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
            >
              START MISSION
            </button>
          </div>
        </div>
      `}

      ${gameState === GameState.GAME_OVER && html`
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-sm z-20 px-4">
          <div className="text-center p-6 bg-black/90 border border-red-500 rounded-xl shadow-[0_0_50px_rgba(255,0,0,0.4)] w-full max-w-sm">
            <h2 className="text-2xl md:text-4xl font-bold text-red-500 mb-2">FAILURE</h2>
            <p className="text-base text-white mb-4">Stage ${stage} Reached</p>
            <div className="text-xl text-yellow-400 mb-6">Score: ${score}</div>
            <div className="flex gap-3 justify-center">
                <button 
                  onClick=${() => setGameState(GameState.MENU)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded shadow text-xs md:text-sm"
                >
                  MENU
                </button>
                <button 
                  onClick=${startGame}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_0_15px_rgba(255,0,0,0.5)] text-xs md:text-sm"
                >
                  RETRY
                </button>
            </div>
          </div>
        </div>
      `}

      ${gameState === GameState.VICTORY && html`
        <div className="absolute inset-0 flex items-center justify-center bg-green-900/40 backdrop-blur-sm z-20 px-4">
          <div className="text-center p-6 bg-black/90 border border-green-500 rounded-xl shadow-[0_0_50px_rgba(0,255,0,0.4)] w-full max-w-sm">
            <h2 className="text-2xl md:text-4xl font-bold text-green-400 mb-2">VICTORY</h2>
            <p className="text-base text-white mb-4">Target Eliminated</p>
            <div className="text-xl text-yellow-400 mb-6">Score: ${score}</div>
            <div className="flex gap-3 justify-center">
                <button 
                  onClick=${() => setGameState(GameState.MENU)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded shadow text-xs md:text-sm"
                >
                  MENU
                </button>
                <button 
                  onClick=${startGame}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-[0_0_15px_rgba(0,255,0,0.5)] text-xs md:text-sm"
                >
                  AGAIN
                </button>
            </div>
          </div>
        </div>
      `}

    </div>
  `;
};

export default App;
