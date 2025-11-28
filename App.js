



import React, { useState } from 'react';
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

  const startGame = () => {
    setGameState(GameState.PLAYING);
  };

  const getWeaponClass = (name) => {
    if (name === 'DEFAULT') return 'border-gray-500 text-gray-400';
    if (name === 'SPREAD') return 'border-green-500 text-green-400';
    if (name === 'RAPID') return 'border-yellow-500 text-yellow-400';
    return 'border-purple-500 text-purple-400';
  };

  return html`
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center font-mono text-white selection:bg-cyan-500 selection:text-black">
      
      <!-- HUD -->
      <div className="absolute top-4 w-full max-w-[800px] flex justify-between px-4 z-10 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">
            SCORE: ${score.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-sm text-cyan-200">PLAYER HP</span>
             <div className="w-48 h-4 bg-gray-900 border border-cyan-700 rounded-sm relative overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-200 ease-out"
                  style=${{ width: `${Math.max(0, health)}%` }}
                />
             </div>
          </div>
          
          <!-- Weapon Status -->
          <div className="flex items-center gap-2 mt-2">
            <div className=${`px-2 py-1 rounded text-xs font-bold border ${getWeaponClass(weaponInfo.name)}`}>
                ${weaponInfo.name} LVL ${weaponInfo.level}
            </div>
            ${weaponInfo.timer > 0 && html`
                <span className="text-white text-sm">${weaponInfo.timer}s</span>
            `}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="text-xl font-bold text-pink-500 drop-shadow-[0_0_5px_rgba(255,0,100,0.8)]">
             STAGE ${stage}/5
          </div>
          <div className="flex items-center gap-2">
             <div className="w-64 h-6 bg-gray-900 border border-pink-900 rounded-sm relative overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-l from-pink-500 to-purple-600 transition-all duration-200 ease-out"
                  style=${{ width: `${Math.max(0, bossHealth)}%` }}
                />
             </div>
             <span className="text-sm text-pink-200">BOSS</span>
          </div>
        </div>
      </div>

      <!-- Game Canvas -->
      <div className="relative z-0">
        <${GameCanvas} 
          setScore=${setScore} 
          setHealth=${setHealth} 
          setBossHealth=${setBossHealth}
          setGameState=${setGameState}
          setStage=${setStage}
          setWeaponInfo=${setWeaponInfo}
          gameState=${gameState}
          selectedBoss=${selectedBoss}
        />
      </div>

      <!-- Menu / Overlays -->
      ${gameState === GameState.MENU && html`
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
          <div className="text-center p-8 border border-cyan-500/30 bg-black/90 rounded-xl shadow-[0_0_50px_rgba(0,255,255,0.2)] max-w-md w-full">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-4 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
              NEON HELL
            </h1>
            <p className="text-cyan-100 mb-8 text-lg">
              Survive 5 Stages. <br/>
              Stack Powerups. <br/>
              Defeat The Construct.
            </p>
            
            <div className="mb-6 flex flex-col items-center gap-2">
              <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Select Target</span>
              <div className="flex gap-2 flex-wrap justify-center">
                <button onClick=${() => setSelectedBoss('RANDOM')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'RANDOM' ? 'bg-cyan-900 border-cyan-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>RANDOM</button>
                <button onClick=${() => setSelectedBoss('CIRCLE')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'CIRCLE' ? 'bg-pink-900 border-pink-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>CIRCLE</button>
                <button onClick=${() => setSelectedBoss('SQUARE')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'SQUARE' ? 'bg-yellow-900 border-yellow-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>SQUARE</button>
                <button onClick=${() => setSelectedBoss('TRIANGLE')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'TRIANGLE' ? 'bg-green-900 border-green-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>TRIANGLE</button>
                <button onClick=${() => setSelectedBoss('HEART')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'HEART' ? 'bg-red-900 border-red-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>HEART</button>
                <button onClick=${() => setSelectedBoss('OVAL')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'OVAL' ? 'bg-purple-900 border-purple-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>OVAL</button>
                <button onClick=${() => setSelectedBoss('HEXAGON')} className=${`px-3 py-1 rounded text-sm font-bold border ${selectedBoss === 'HEXAGON' ? 'bg-cyan-900 border-cyan-400 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>HEXAGON</button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-400 mb-8 text-left mx-auto w-fit">
               <p>Controls:</p>
               <p><kbd className="px-2 py-1 bg-gray-800 rounded text-white">WASD</kbd> or <kbd className="px-2 py-1 bg-gray-800 rounded text-white">Mouse / Touch</kbd> to Move</p>
               <p>Shooting is <span className="text-green-400">AUTOMATIC</span></p>
               <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                 <p><span className="text-green-400 font-bold">S</span> Spread Shot</p>
                 <p><span className="text-yellow-400 font-bold">R</span> Rapid Fire</p>
                 <p><span className="text-purple-400 font-bold">H</span> Homing Missile</p>
                 <p><span className="text-pink-400 font-bold">+</span> Repair Kit</p>
               </div>
            </div>

            <button 
              onClick=${startGame}
              className="px-8 py-3 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-all hover:scale-105 active:scale-95"
            >
              INITIATE SYSTEM
            </button>
          </div>
        </div>
      `}

      ${gameState === GameState.GAME_OVER && html`
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-sm z-20">
          <div className="text-center p-8 bg-black/90 border border-red-500 rounded-xl shadow-[0_0_50px_rgba(255,0,0,0.4)]">
            <h2 className="text-5xl font-bold text-red-500 mb-2">CRITICAL FAILURE</h2>
            <p className="text-xl text-white mb-6">System Destroyed at Stage ${stage}</p>
            <div className="text-2xl text-yellow-400 mb-8">Final Score: ${score}</div>
            <div className="flex gap-4 justify-center">
                <button 
                  onClick=${() => setGameState(GameState.MENU)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded shadow transition-all hover:scale-105 active:scale-95"
                >
                  RETURN TO BASE
                </button>
                <button 
                  onClick=${startGame}
                  className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_0_15px_rgba(255,0,0,0.5)] transition-all hover:scale-105 active:scale-95"
                >
                  REBOOT SYSTEM
                </button>
            </div>
          </div>
        </div>
      `}

      ${gameState === GameState.VICTORY && html`
        <div className="absolute inset-0 flex items-center justify-center bg-green-900/40 backdrop-blur-sm z-20">
          <div className="text-center p-8 bg-black/90 border border-green-500 rounded-xl shadow-[0_0_50px_rgba(0,255,0,0.4)]">
            <h2 className="text-5xl font-bold text-green-400 mb-2">TARGET ELIMINATED</h2>
            <p className="text-xl text-white mb-6">Mission Accomplished</p>
            <div className="text-2xl text-yellow-400 mb-8">Final Score: ${score}</div>
            <div className="flex gap-4 justify-center">
                <button 
                  onClick=${() => setGameState(GameState.MENU)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded shadow transition-all hover:scale-105 active:scale-95"
                >
                  RETURN TO BASE
                </button>
                <button 
                  onClick=${startGame}
                  className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-[0_0_15px_rgba(0,255,0,0.5)] transition-all hover:scale-105 active:scale-95"
                >
                  PLAY AGAIN
                </button>
            </div>
          </div>
        </div>
      `}

    </div>
  `;
};

export default App;