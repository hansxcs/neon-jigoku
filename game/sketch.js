
import p5 from 'p5';
import { COLORS, PLAYER_SPEED, PLAYER_RADIUS, BOSS_RADIUS, BOSS_SQUARE_SIZE, BOSS_MAX_HP, BULLET_SPEED, PLAYER_HITBOX, ENEMY_BULLET_BASE_SPEED, MAX_WEAPON_LEVEL, BASE_BULLET_SPEED_SCALE, OVAL_BOSS_MOVE_SPEED, SHIELD_DURATION, MAX_SHIELD_CHARGES, BOSS_SCORE_REWARD, SCORE_PER_HIT } from '../constants.js';
import { GameState, PowerUpType, WeaponType } from '../types.js';
import { CircleBoss } from './bosses/circle.js';
import { SquareBoss } from './bosses/square.js';
import { TriangleBoss } from './bosses/triangle.js';
import { HeartBoss } from './bosses/heart.js';
import { OvalBoss } from './bosses/oval.js';
import { HexagonBoss } from './bosses/hexagon.js';
import { HourglassBoss } from './bosses/hourglass.js';
import { MathBoss } from './bosses/math.js';
import { StarBoss } from './bosses/star.js';
import { drawGlitch } from './utils.js';
import { SoundManager } from './sound.js';

const BOSS_MODULES = {
    'CIRCLE': CircleBoss,
    'SQUARE': SquareBoss,
    'TRIANGLE': TriangleBoss,
    'HEART': HeartBoss,
    'OVAL': OvalBoss,
    'HEXAGON': HexagonBoss,
    'HOURGLASS': HourglassBoss,
    'MATH': MathBoss,
    'STAR': StarBoss
};

const BOSS_TITLES = {
    'CIRCLE': "THE CORE",
    'SQUARE': "THE CONSTRUCT",
    'TRIANGLE': "THE PRISM",
    'HEART': "THE SEDUCTRESS",
    'OVAL': "THE RICOCHET",
    'HEXAGON': "THE BLITZ",
    'HOURGLASS': "THE CHRONOS",
    'MATH': "THE CALCULATOR",
    'STAR': "THE SUPERNOVA"
};

const MAX_PARTICLES = 200;

export const createSketch = (
  setScore, setHealth, setBossHealth, setGameState, setStage, setWeaponInfo,
  triggerShieldRef, setPlayerStatus, bulletSpeedRef, lowFPSRef, targetW, targetH
) => {
  return (p) => {
    // --- Game Entities ---
    let gameState = GameState.MENU;
    let score = 0;
    
    // Player
    let player = {
      pos: p.createVector(targetW / 2, targetH - 100),
      hp: 100,
      radius: PLAYER_RADIUS,
      hitbox: PLAYER_HITBOX,
      bullets: [],
      weaponType: WeaponType.DEFAULT,
      weaponLevel: 1, 
      weaponTimer: 0,
      damageMult: 1,
      invulnerable: 0,
      shieldTimer: 0,
      shieldCharges: MAX_SHIELD_CHARGES,
      frozen: false, 
      freezeTimer: 0
    };

    // Boss Object (Generic + Specifics)
    let boss = {
      active: true,
      pos: p.createVector(targetW / 2, 100),
      vel: p.createVector(0,0),
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      type: 'CIRCLE',
      phase: 0,
      radius: BOSS_RADIUS,
      angle: 0,
      opacity: 255,
      flashTimer: 0, // Visual feedback when hit
      nextPowerUpHp: 0,
      shield: 0, // Add generic shield prop
      maxShield: 0,
      // ... boss specific properties injected by init()
    };

    // Game Logic Globals
    let currentStageIndex = 0;
    let stageTransitionTimer = 0;
    let globalTimeScale = 1.0; 
    let simTime = 0; 
    let frame = 0;
    
    // Intro Logic
    let introTimer = 0;
    let introActive = false;
    let currentBossTitle = "";
    let introShake = 0;
    let introFlash = 0;

    // Arrays
    let enemies = [];
    let enemyBullets = [];
    let powerUps = [];
    let particles = [];
    let blockers = []; 
    let sandTraps = [];
    let stasisOrbs = [];
    let mathParticles = [];
    let stars = [];

    // --- Helpers ---
    const spawnEnemyBullet = (x, y, vx, vy, speed, color, shape = 'CIRCLE', bounces = 0, canSplit = false, accelerating = false, subType = null) => {
      if (enemyBullets.length > 500) return;
      // Default to white if color is undefined to prevent crash
      const safeColor = color || [255, 255, 255];
      let b = {
        pos: p.createVector(x, y),
        vel: p.createVector(vx * speed, vy * speed),
        color: safeColor, r: 6, shape: shape, angle: 0, bounces: bounces,
        canSplit: canSplit, splitTimer: canSplit ? p.random(30, 60) : 0, splitGen: canSplit ? 2 : 0,
        accelerating: accelerating, speed: speed, subType: subType
      };
      if (shape === 'BINARY') {
          b.text = p.random() > 0.5 ? '1' : '0';
          if (b.text === '1') b.vel.x = p.random(-1, 1);
      }
      enemyBullets.push(b);
    };

    const spawnMeteorAttack = (x, y, targetX, targetY, delay = 60, size = 15) => {
        const angle = Math.atan2(targetY - y, targetX - x);
        if (!boss.pendingAttacks) boss.pendingAttacks = [];
        boss.pendingAttacks.push({
            type: 'METEOR', x: x, y: y, dx: Math.cos(angle), dy: Math.sin(angle),
            timer: delay, size: size
        });
        SoundManager.playSFX('alert');
    };

    const spawnStasisOrb = () => {
        stasisOrbs.push({ x: p.random(50, p.width-50), y: p.random(50, 200), vx: p.random(-1, 1), vy: p.random(1, 2), radius: 20 });
    };

    const spawnMathParticle = () => {
        if (mathParticles.length > 30) return;
        mathParticles.push({
            x: p.random(p.width), y: p.random(p.height), vx: p.random(-0.5, 0.5), vy: p.random(-0.5, 0.5),
            life: 1.0, text: p.random(['π', '∞', '∑', '∫', '√', '≠', '±', '∆', '%', '!']), size: p.random(12, 24)
        });
    };
    
    const spawnMinion = (forcedType = null, forcedX = null, forcedY = null, parent = null) => {
      if (enemies.length >= 30) return; 
      const type = forcedType || (p.random() > 0.5 ? 'drone' : 'swooper');
      const x = (forcedX !== null) ? forcedX : p.random(50, p.width - 50);
      const y = (forcedY !== null) ? forcedY : -30;
      let hp = 30; let radius = 15; let scoreVal = 100;

      if (type === 'drone') hp = 30;
      if (type === 'swooper') hp = 20;
      if (type === 'orbiter') { hp = 60; radius = 10; }
      if (type === 'mini_boss') { hp = 500; radius = 30; scoreVal = 1000; }
      if (type === 'lust_orb') { hp = 1200; radius = 100; scoreVal = 2000; }

      createExplosion(x, y, COLORS.BOSS_TRIANGLE, 5); // Lightweight spawn effect

      enemies.push({
        pos: p.createVector(x, y), vel: p.createVector(0, 0),
        hp: hp, maxHp: hp, radius: radius, type: type,
        shootTimer: p.random(60, 120), orbitAngle: p.random(p.TWO_PI), 
        parent: parent, scoreVal: scoreVal
      });
    };

    const createExplosion = (x, y, color, count) => {
      if (particles.length > MAX_PARTICLES) return;
      // Safe color check
      const safeColor = color || [255, 255, 255];
      for(let i=0; i<count; i++) {
        const angle = p.random(p.TWO_PI);
        const speed = p.random(1, 4);
        particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1.0, color: safeColor, size: p.random(2, 5)
        });
      }
    };

    // --- Setup ---
    p.setup = () => {
      p.createCanvas(targetW, targetH);
      p.frameRate(60);
      
      SoundManager.init(); // Init Sound

      for(let i=0; i<100; i++) stars.push({ x: p.random(p.width), y: p.random(p.height), z: p.random(0.5, 3) });
      if (triggerShieldRef) {
          triggerShieldRef.current = () => {
              if (player.shieldCharges > 0 && player.shieldTimer <= 0 && gameState === GameState.PLAYING && !player.frozen) {
                  player.shieldCharges--; player.shieldTimer = SHIELD_DURATION; updatePlayerStatus();
                  SoundManager.playSFX('shield');
              }
          };
      }
    };

    p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        stars = []; for(let i=0; i<100; i++) stars.push({ x: p.random(p.width), y: p.random(p.height), z: p.random(0.5, 3) });
    };
    p.touchMoved = () => false;

    const resetGame = (bossType = 'RANDOM') => {
      player.pos = p.createVector(p.width / 2, p.height - 100);
      player.hp = 100; player.bullets = []; player.weaponType = WeaponType.DEFAULT; player.weaponLevel = 1; player.invulnerable = 0; player.frozen = false;
      boss.hp = BOSS_MAX_HP; boss.active = true; boss.pos = p.createVector(p.width / 2, 100); boss.vel = p.createVector(p.random([-3,3]), p.random(2,3));
      boss.nextPowerUpHp = BOSS_MAX_HP * 0.95;
      boss.flashTimer = 0;
      boss.shield = 0; 
      boss.maxShield = 0;
      
      if (bossType !== 'RANDOM') boss.type = bossType;
      else boss.type = p.random(Object.keys(BOSS_MODULES));
      
      // Init Boss Specifics
      if (BOSS_MODULES[boss.type] && BOSS_MODULES[boss.type].init) {
          BOSS_MODULES[boss.type].init(boss);
      }
      
      // Setup Intro (Shorter, Cleaner)
      introActive = true;
      introTimer = 120; // 2 seconds (Reduced from 180)
      currentBossTitle = BOSS_TITLES[boss.type] || "UNKNOWN THREAT";
      introShake = 0;
      introFlash = 0;

      currentStageIndex = 0; stageTransitionTimer = 0; globalTimeScale = 1.0; simTime = 0; frame = 0; score = 0;
      enemies = []; enemyBullets = []; powerUps = []; particles = []; blockers = []; sandTraps = []; stasisOrbs = []; mathParticles = [];

      setScore(0); setHealth(100); setBossHealth(100); setStage(1);
      setWeaponInfo({ name: 'DEFAULT', level: 1, timer: 0 }); updatePlayerStatus();
      
      SoundManager.playBGM(boss.type); // Start Music
    };

    const updatePlayerStatus = () => {
        if (setPlayerStatus) setPlayerStatus({ shieldCharges: player.shieldCharges, shieldTimer: Math.ceil(player.shieldTimer / 60) });
    };

    const drawMathGrid = () => {
        if (COLORS.BOSS_MATH_GRID) p.stroke(...COLORS.BOSS_MATH_GRID); else p.stroke(50, 50, 80, 50); 
        p.strokeWeight(1);
        for(let x = 0; x <= p.width; x += 40) p.line(x, 0, x, p.height);
        for(let y = 0; y <= p.height; y += 40) p.line(0, y, p.width, y);
        // Ensure right/bottom edges are drawn
        p.line(p.width-1, 0, p.width-1, p.height);
        p.line(0, p.height-1, p.width, p.height-1);
    };

    // --- MAIN DRAW LOOP ---
    p.draw = () => {
      // Dynamic Framerate
      if (lowFPSRef && lowFPSRef.current) p.frameRate(30); else p.frameRate(60);

      const userSpeedScale = bulletSpeedRef?.current || 1.0;
      let baseSpeed = (ENEMY_BULLET_BASE_SPEED + (currentStageIndex * 0.5)) * BASE_BULLET_SPEED_SCALE * userSpeedScale;

      p.background(COLORS.BACKGROUND, 100);
      
      // Global Intro Shake (Subtle)
      if (introShake > 0) {
          p.push();
          // Minimal shake
          const shakeAmt = Math.min(introShake, 5); 
          p.translate(p.random(-shakeAmt, shakeAmt), p.random(-shakeAmt, shakeAmt));
          introShake *= 0.8; // Fast decay
      }
      
      // Camera Shake (Gameplay)
      if (stageTransitionTimer > 150) { p.push(); p.translate(p.random(-5, 5), p.random(-5, 5)); }

      // Stars (Performance Optimized)
      p.stroke(255, 150);
      for(let star of stars) {
        star.y += star.z; if(star.y > p.height) { star.y = 0; star.x = p.random(p.width); }
        p.strokeWeight(star.z);
        p.point(star.x, star.y);
      }
      p.strokeWeight(1); // Reset

      // Math Particles
      for(let i=mathParticles.length-1; i>=0; i--) {
          let mp = mathParticles[i]; mp.x += mp.vx; mp.y += mp.vy; mp.life -= 0.01;
          p.textSize(mp.size); p.fill(200, 200, 255, mp.life * 150); p.text(mp.text, mp.x, mp.y);
          if (mp.life <= 0) mathParticles.splice(i, 1);
      }
      
      // Explosion Particles
      for(let i=particles.length-1; i>=0; i--) {
          let pt = particles[i];
          pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.05;
          let alpha = pt.life * 255;
          if (pt.isShockwave) {
              p.noFill(); p.stroke(pt.color[0], pt.color[1], pt.color[2], alpha);
              p.strokeWeight(2); p.circle(pt.x, pt.y, (1.0-pt.life)*100);
          } else {
              p.noStroke(); 
              // Safe access
              if (pt.color) p.fill(pt.color[0], pt.color[1], pt.color[2], alpha);
              else p.fill(255, alpha);
              p.circle(pt.x, pt.y, pt.size);
          }
          if(pt.life <= 0) particles.splice(i, 1);
      }

      if (boss.type === 'MATH' && boss.active) {
          drawMathGrid();
          if (frame % 60 === 0 && mathParticles.length < 20) spawnMathParticle();
      }

      if (gameState !== GameState.PLAYING) {
        if (stageTransitionTimer > 150) p.pop();
        if (introShake > 0) p.pop(); // Restore shake push
        return;
      }
      
      // --- BOSS INTRO SEQUENCE (CLEANED UP) ---
      if (introActive) {
          introTimer--;
          const maxIntro = 120;
          const introProgress = 1.0 - (introTimer/maxIntro);
          
          const triggerIntroEffect = (type, mag) => {
              if (type === 'SHAKE') introShake = mag;
              if (type === 'FLASH') introFlash = mag;
          };

          // Call Boss Intro Draw
          if (BOSS_MODULES[boss.type] && BOSS_MODULES[boss.type].drawIntro) {
              p.push();
              p.translate(p.width/2, 200);
              BOSS_MODULES[boss.type].drawIntro(p, boss, introProgress, triggerIntroEffect);
              p.pop();
          }

          // Draw Cinematic Overlay (Cleaner, fading)
          // Fade out at end
          let alpha = 255;
          if (introProgress > 0.8) alpha = p.map(introProgress, 0.8, 1.0, 255, 0);
          
          p.noStroke();
          p.fill(0, alpha * 0.7); // Semi-transparent black bars
          const barHeight = p.map(introProgress, 0, 0.2, 0, 80);
          p.rect(0, 0, p.width, barHeight);
          p.rect(0, p.height - barHeight, p.width, barHeight);
          
          // Text Fade In
          if (introProgress > 0.2) {
              p.textAlign(p.CENTER, p.CENTER);
              p.fill(255, alpha);
              p.textSize(50); 
              p.text(boss.type, p.width/2, p.height/2);
              
              p.fill(150, 200, 255, alpha);
              p.textSize(20); 
              p.text(currentBossTitle, p.width/2, p.height/2 + 40);
          }

          if (introTimer <= 0) {
              introActive = false;
          }
          
          // Subtle Flash only
          if (introFlash > 0) {
              p.fill(255, Math.min(introFlash, 100)); // Cap flash opacity
              p.rect(0, 0, p.width, p.height);
              introFlash -= 10;
          }

          if (introShake > 0) p.pop(); // Restore global shake push
          return; // Skip main game loop logic
      }
      
      if (introShake > 0) p.pop(); // Restore global shake push if not in intro but lingering

      // --- Update ---
      frame++; simTime += globalTimeScale;
      
      // Update Player Shield Timer Logic
      if (player.shieldTimer > 0) { 
          player.shieldTimer--; 
          // Force update when timer hits exactly 0 to fix UI stuck at '1s'
          if (player.shieldTimer === 0) updatePlayerStatus();
          else if (frame % 30 === 0) updatePlayerStatus(); 
      }
      
      if (player.freezeTimer > 0) { player.freezeTimer--; if (player.freezeTimer <= 0) player.frozen = false; }

      // 1. Player Move
      let dx = 0; let dy = 0; let speedMult = 1.0;
      for (let trap of sandTraps) if (p.dist(player.pos.x, player.pos.y, trap.x, trap.y) < trap.r + PLAYER_RADIUS) speedMult = 0.3;
      
      if (!player.frozen) {
          if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)) dx -= PLAYER_SPEED * speedMult;
          if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) dx += PLAYER_SPEED * speedMult;
          if (p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) dy -= PLAYER_SPEED * speedMult;
          if (p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)) dy += PLAYER_SPEED * speedMult;
          if (p.keyIsDown(32) && triggerShieldRef.current) triggerShieldRef.current();

          if (dx === 0 && dy === 0) { // Mouse/Touch fallback
            let targetX = player.pos.x; let targetY = player.pos.y;
            const rect = p.canvas.getBoundingClientRect();
            if (p.touches.length > 0) {
               targetX = (p.touches[0].x - rect.left) * (p.width / rect.width);
               targetY = (p.touches[0].y - rect.top) * (p.height / rect.height) - 60; 
            } else if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
               targetX = p.mouseX; targetY = p.mouseY;
            }
            dx = (targetX - player.pos.x) * 0.2 * speedMult; dy = (targetY - player.pos.y) * 0.2 * speedMult;
          }
      }
      // Check Blockers
      const checkBlocker = (x, y) => blockers.some(b => x > b.pos.x - b.w/2 - PLAYER_RADIUS && x < b.pos.x + b.w/2 + PLAYER_RADIUS && y > b.pos.y - b.h/2 - PLAYER_RADIUS && y < b.pos.y + b.h/2 + PLAYER_RADIUS);
      if (!checkBlocker(player.pos.x + dx, player.pos.y)) player.pos.x += dx;
      if (!checkBlocker(player.pos.x, player.pos.y + dy)) player.pos.y += dy;
      player.pos.x = p.constrain(player.pos.x, PLAYER_RADIUS, p.width - PLAYER_RADIUS);
      player.pos.y = p.constrain(player.pos.y, PLAYER_RADIUS, p.height - PLAYER_RADIUS);

      // Render Blockers
      p.noStroke(); p.fill(...COLORS.BLOCKER); p.rectMode(p.CENTER);
      for(let b of blockers) { p.rect(b.pos.x, b.pos.y, b.w, b.h); p.stroke(255, 100); p.noFill(); p.rect(b.pos.x, b.pos.y, b.w, b.h); p.noStroke(); p.fill(...COLORS.BLOCKER); }

      // 2. Player Shoot
      if (player.weaponTimer > 0) { player.weaponTimer--; if (player.weaponTimer <= 0) { player.weaponType = WeaponType.DEFAULT; player.weaponLevel = 1; } }
      if (frame % 10 === 0) {
        const getName = t => Object.keys(WeaponType).find(k => WeaponType[k] === t) || 'DEFAULT';
        setWeaponInfo({ name: getName(player.weaponType), level: player.weaponLevel, timer: Math.ceil(player.weaponTimer / 60) });
      }
      if (!player.frozen && frame % (player.weaponType === WeaponType.RAPID ? Math.max(2, 5 - player.weaponLevel) : 8) === 0) {
          SoundManager.playSFX('shoot');
          const lvl = player.weaponLevel;
          if (player.weaponType === WeaponType.DEFAULT) {
               player.bullets.push({ pos: player.pos.copy().add(-5,-10), vel: p.createVector(0,-BULLET_SPEED), dmg: 10, homing: false });
               player.bullets.push({ pos: player.pos.copy().add(5,-10), vel: p.createVector(0,-BULLET_SPEED), dmg: 10, homing: false });
               if (lvl >= 3) { player.bullets.push({pos:player.pos.copy().add(-12,-5), vel:p.createVector(-2,-BULLET_SPEED), dmg:10}); player.bullets.push({pos:player.pos.copy().add(12,-5), vel:p.createVector(2,-BULLET_SPEED), dmg:10}); }
          } else if (player.weaponType === WeaponType.RAPID) {
               player.bullets.push({ pos: player.pos.copy().add(0, -10), vel: p.createVector(0, -BULLET_SPEED * 1.5), dmg: 8 });
          } else if (player.weaponType === WeaponType.SPREAD) {
               for(let i=0; i<3+(lvl*2); i++) {
                   const a = -p.PI/2 + (i - (3+(lvl*2)-1)/2) * (0.2+lvl*0.1);
                   player.bullets.push({ pos: player.pos.copy(), vel: p.createVector(Math.cos(a)*BULLET_SPEED, Math.sin(a)*BULLET_SPEED), dmg: 8 });
               }
          } else if (player.weaponType === WeaponType.HOMING) {
               for(let i=0; i<1+(lvl*2); i++) {
                   const a = -p.PI/2 + p.random(-0.5, 0.5);
                   player.bullets.push({ pos: player.pos.copy(), vel: p.createVector(Math.cos(a)*BULLET_SPEED*0.5, Math.sin(a)*BULLET_SPEED*0.5), dmg: 12, homing: true });
               }
          }
      }

      // 3. Boss Update
      if (boss.active) {
          if (boss.flashTimer > 0) boss.flashTimer--;

          // Stage Calculation
          const pct = boss.hp / BOSS_MAX_HP;
          let stage = 0; if(pct<0.2) stage=4; else if(pct<0.4) stage=3; else if(pct<0.6) stage=2; else if(pct<0.8) stage=1;
          
          if (stage > currentStageIndex) {
              currentStageIndex = stage; setStage(stage + 1); stageTransitionTimer = 180;
              enemyBullets = []; stasisOrbs = []; createExplosion(boss.pos.x, boss.pos.y, COLORS[`BOSS_${boss.type}`] || [255,255,255], 40);
              SoundManager.playSFX('explosion');
              // Init Stage Specifics
              if (BOSS_MODULES[boss.type] && BOSS_MODULES[boss.type].onStageChange) {
                  BOSS_MODULES[boss.type].onStageChange(boss, stage, spawnMinion);
              }
          }

          // Delegate to Module
          if (BOSS_MODULES[boss.type]) {
              const data = {
                  frame, stage: currentStageIndex, baseSpeed, 
                  spawnBullet: spawnEnemyBullet, spawnMinion, spawnMeteorAttack, spawnStasisOrb, spawnMathParticle, createExplosion,
                  setHealth, enemies, enemyBullets, particles, blockers, sandTraps, stageTransitionTimer, globalTimeScale
              };
              
              // Update returns new time scale if boss modifies it (Hourglass)
              const newTime = BOSS_MODULES[boss.type].update(p, boss, player, data);
              if (newTime !== undefined) globalTimeScale = newTime;
          }
      }

      // 4. Draw Boss
      if (boss.active) {
          p.push();
          p.translate(boss.pos.x, boss.pos.y);
          p.rotate(boss.angle);
          
          if (stageTransitionTimer > 0) { 
               // Warning Flash
               if (frame % 4 < 2) { p.fill(255); p.stroke(255); }
               else { 
                   // Let specific draw handle default, but default usually needs explicit set if generic
               }
               boss.opacity = 255; 
          } 
          
          // Delegate Draw
          if (BOSS_MODULES[boss.type]) BOSS_MODULES[boss.type].draw(p, boss, frame);
          p.pop();
      }

      // 5. Entities Update & Render
      // Minions
      for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.type === 'drone') e.pos.y += 1.5;
        else if (e.type === 'swooper') { e.pos.y += 2.5; e.pos.x += Math.sin(frame * 0.05) * 3 + Math.cos(Math.atan2(player.pos.y-e.pos.y, player.pos.x-e.pos.x)); }
        else if (e.type === 'orbiter') { if(e.parent && e.parent.active) { e.orbitAngle+=0.05; e.pos.x = e.parent.pos.x+Math.cos(e.orbitAngle)*100; e.pos.y=e.parent.pos.y+Math.sin(e.orbitAngle)*100; } else e.hp=0; }
        else if (e.type === 'mini_boss') { e.pos.x += Math.sin(frame * 0.02) * 2; e.pos.y = 150 + Math.cos(frame*0.03)*30; if(frame%120===0) spawnMinion('drone', e.pos.x, e.pos.y+30); }
        else if (e.type === 'lust_orb') { let a = Math.atan2(player.pos.y-e.pos.y, player.pos.x-e.pos.x); e.pos.x+=Math.cos(a)*0.75; e.pos.y+=Math.sin(a)*0.75; }

        if (e.shootTimer > 0) e.shootTimer--;
        else {
           if (e.type === 'drone') { spawnEnemyBullet(e.pos.x, e.pos.y, 0, 1, baseSpeed * 0.8, COLORS.ENEMY_BULLET); e.shootTimer = 120; }
           // ... other logic
        }
        
        const c = e.type === 'lust_orb' ? COLORS.ENEMY_LUST_ORB : (e.type === 'mini_boss' ? COLORS.ENEMY_MINI_BOSS : COLORS.ENEMY);
        p.fill(...c); 
        p.noStroke();
        if (e.type==='lust_orb') p.circle(e.pos.x, e.pos.y, e.radius*2);
        else { p.push(); p.translate(e.pos.x, e.pos.y); p.rotate(e.type==='swooper' ? Math.sin(frame*0.1) : frame*0.05); p.triangle(0, e.radius, -e.radius, -e.radius, e.radius, -e.radius); p.pop(); }
        
        if (e.pos.y > p.height+50) enemies.splice(i, 1);
      }
      
      // Bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
          let b = enemyBullets[i];
          if (b.accelerating) { b.speed *= 1.03; b.vel.setMag(b.speed); }
          if (b.canSplit && b.splitTimer > 0) {
              b.splitTimer--; 
              if (b.splitTimer <= 0 && b.splitGen > 0) {
                  createExplosion(b.pos.x, b.pos.y, b.color, 3);
                  let ca = Math.atan2(b.vel.y, b.vel.x);
                  for(let k=0; k<4; k++) { let na = ca + (p.HALF_PI*k); spawnEnemyBullet(b.pos.x, b.pos.y, Math.cos(na), Math.sin(na), b.speed*1.2, b.color, 'CIRCLE', 0, true); enemyBullets[enemyBullets.length-1].splitGen = b.splitGen - 1; }
                  enemyBullets.splice(i, 1); continue;
              }
          }
          if (boss.type === 'HOURGLASS' && boss.timeState === 'STOPPED') { 
              if (b.shape === 'KNIFE') { 
                  p.push(); p.translate(b.pos.x + p.random(-1,1), b.pos.y + p.random(-1,1)); p.rotate(b.angle); 
                  if (Array.isArray(b.color)) p.fill(...b.color); else p.fill(255);
                  p.triangle(-5,-3,-5,3,10,0); p.pop(); 
              }
              else { 
                  if (Array.isArray(b.color)) p.fill(...b.color); else p.fill(255);
                  p.circle(b.pos.x, b.pos.y, b.r*2); 
              }
          } else {
              b.pos.x += b.vel.x * globalTimeScale; b.pos.y += b.vel.y * globalTimeScale;
              if (b.bounces > 0) { if(b.pos.x<0||b.pos.x>p.width) { b.vel.x*=-1; b.bounces--; } if(b.pos.y<0||b.pos.y>p.height) { b.vel.y*=-1; b.bounces--; } }
              
              // Safe color fill with spread
              if (Array.isArray(b.color)) p.fill(...b.color);
              else if (b.color) p.fill(b.color); 
              else p.fill(255);
              
              p.noStroke();
              
              if (b.shape === 'CIRCLE') p.circle(b.pos.x, b.pos.y, b.r*2);
              else if (b.shape === 'RECT') { p.push(); p.translate(b.pos.x, b.pos.y); p.rotate(frame*0.2); p.rect(0,0,10,20); p.pop(); }
              else if (b.shape === 'METEOR') { p.circle(b.pos.x, b.pos.y, 25); p.fill(255, 100); p.circle(b.pos.x-b.vel.x*2, b.pos.y-b.vel.y*2, 15); }
              else if (b.shape === 'HEAL') { p.fill(0,255,0); p.textSize(10); p.text("+", b.pos.x, b.pos.y); }
              else if (b.shape === 'KNIFE') { p.push(); p.translate(b.pos.x, b.pos.y); p.rotate(b.angle); p.triangle(-5,-3,-5,3,10,0); p.pop(); }
              else if (b.shape === 'BINARY') { p.fill(0,255,100); p.textSize(14); p.text(b.text||'1', b.pos.x, b.pos.y); }
              else if (b.shape === 'GEOMETRY') {
                  p.push(); p.translate(b.pos.x, b.pos.y); p.rotate(frame * 0.1);
                  if (b.subType === 'TRIANGLE') p.triangle(0, -6, -6, 6, 6, 6);
                  else if (b.subType === 'SQUARE') p.rect(0,0,12,12);
                  else if (b.subType === 'PENTAGON') { p.beginShape(); for(let k=0; k<5; k++) { let a=k*p.TWO_PI/5; p.vertex(Math.cos(a)*8, Math.sin(a)*8); } p.endShape(p.CLOSE); }
                  p.pop();
              }
          }
          if (b.pos.x < -50 || b.pos.x > p.width + 50 || b.pos.y < -50 || b.pos.y > p.height + 50) enemyBullets.splice(i, 1);
      }

      // Player Bullets
      for (let i = player.bullets.length - 1; i >= 0; i--) {
        let b = player.bullets[i];
        if (b.homing) {
            let t = boss.active ? boss : null;
            let md = 10000;
            for(let e of enemies) { let d = p.dist(b.pos.x, b.pos.y, e.pos.x, e.pos.y); if(d<md) { md=d; t=e; } }
            if (boss.active) { let d = p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y); if(d<md) t=boss; }
            if (t) { let a = Math.atan2(t.pos.y-b.pos.y, t.pos.x-b.pos.x); b.vel.x = p.lerp(b.vel.x, Math.cos(a)*BULLET_SPEED, 0.2); b.vel.y = p.lerp(b.vel.y, Math.sin(a)*BULLET_SPEED, 0.2); }
        }
        b.pos.add(b.vel); p.fill(...COLORS.PLAYER_BULLET); p.circle(b.pos.x, b.pos.y, 8);
        if (b.pos.y < -10) player.bullets.splice(i, 1);
      }
      
      // Powerups
      for (let i = powerUps.length - 1; i >= 0; i--) {
          let pu = powerUps[i];
          pu.y += 2;
          // Magnetism
          let d = p.dist(player.pos.x, player.pos.y, pu.x, pu.y);
          if (d < 150) {
              pu.x = p.lerp(pu.x, player.pos.x, 0.05);
              pu.y = p.lerp(pu.y, player.pos.y, 0.05);
          }

          // Constrain bounds
          pu.x = p.constrain(pu.x, 20, p.width-20);
          
          let col = COLORS.POWERUP_SPREAD;
          let txt = 'S';
          let textColor = 0; // Black text by default
          if (pu.type === PowerUpType.RAPID) { col = COLORS.POWERUP_RAPID; txt = 'R'; }
          if (pu.type === PowerUpType.HOMING) { col = COLORS.POWERUP_HOMING; txt = 'H'; }
          if (pu.type === PowerUpType.HEAL) { col = COLORS.POWERUP_HEAL; txt = '+'; }
          if (pu.type === PowerUpType.SHIELD) { col = COLORS.POWERUP_SHIELD; txt = 'S+'; }
          if (pu.type === PowerUpType.TRAP) { col = COLORS.POWERUP_TRAP; txt = '!'; textColor = 255; } // White text for dark trap

          p.fill(...col); p.noStroke();
          // Visual Pulse
          let pulseSize = 20 + Math.sin(frame * 0.2) * 4;
          p.circle(pu.x, pu.y, pulseSize);
          
          // Ring
          p.noFill(); p.stroke(255, 150); p.strokeWeight(2);
          p.circle(pu.x, pu.y, pulseSize + 4);
          
          p.noStroke();
          p.fill(textColor); p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.text(txt, pu.x, pu.y);
          
          if (d < player.radius + 15) {
              SoundManager.playSFX('powerup');
              if (pu.type === PowerUpType.HEAL) { player.hp = Math.min(100, player.hp + 20); setHealth(player.hp); }
              else if (pu.type === PowerUpType.SHIELD) { player.shieldCharges = Math.min(MAX_SHIELD_CHARGES, player.shieldCharges + 1); updatePlayerStatus(); }
              else if (pu.type === PowerUpType.TRAP) { player.hp -= 30; setHealth(player.hp); createExplosion(player.pos.x, player.pos.y, COLORS.POWERUP_TRAP, 10); SoundManager.playSFX('explosion'); }
              else {
                  // If same weapon, level up. If different, switch.
                  // Map PowerUpType to WeaponType
                  let wType = pu.type; 
                  // If trap logic handled above, here it's purely weapons
                  if (player.weaponType === wType) player.weaponLevel = Math.min(MAX_WEAPON_LEVEL, player.weaponLevel + 1);
                  else { player.weaponType = wType; player.weaponLevel = 1; }
                  player.weaponTimer = 600;
              }
              powerUps.splice(i, 1);
          } else if (pu.y > p.height) powerUps.splice(i, 1);
      }

      // Collisions
      if (player.invulnerable > 0) player.invulnerable--;
      if (player.invulnerable % 10 < 5) {
          p.fill(...COLORS.PLAYER); p.noStroke(); p.triangle(player.pos.x, player.pos.y-PLAYER_RADIUS*1.5, player.pos.x-PLAYER_RADIUS, player.pos.y+PLAYER_RADIUS, player.pos.x+PLAYER_RADIUS, player.pos.y+PLAYER_RADIUS, player.pos.y+PLAYER_RADIUS);
          p.fill(255, 0, 0); p.circle(player.pos.x, player.pos.y, PLAYER_HITBOX * 2);
          if (player.shieldTimer > 0) { p.noFill(); p.stroke(...COLORS.PLAYER_SHIELD); p.strokeWeight(2); p.circle(player.pos.x, player.pos.y, 50); }
      }
      for (let i = 0; i < enemyBullets.length; i++) {
          let b = enemyBullets[i];
          if (p.dist(player.pos.x, player.pos.y, b.pos.x, b.pos.y) < player.hitbox + b.r) {
             if (b.shape === 'HEAL') { player.hp = Math.min(100, player.hp + 10); setHealth(player.hp); enemyBullets.splice(i, 1); SoundManager.playSFX('powerup'); continue; }
             if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
               player.hp -= Math.ceil(10 / userSpeedScale); setHealth(player.hp); player.invulnerable = 60; createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 10); enemyBullets.splice(i, 1);
               SoundManager.playSFX('hit');
               if (player.hp <= 0) { setGameState(GameState.GAME_OVER); gameState = GameState.GAME_OVER; SoundManager.stopBGM(); }
             } else enemyBullets.splice(i, 1);
          }
      }
      
      let bossTouch = boss.radius + player.hitbox;
      if (boss.type === 'SQUARE') bossTouch = BOSS_SQUARE_SIZE/2 + player.hitbox;
      if (p.dist(player.pos.x, player.pos.y, boss.pos.x, boss.pos.y) < bossTouch && player.invulnerable <= 0 && player.shieldTimer <= 0) {
             player.hp -= 20; setHealth(player.hp); player.invulnerable = 90; createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 20);
             let a = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x); player.pos.x += Math.cos(a)*50; player.pos.y += Math.sin(a)*50;
             SoundManager.playSFX('hit');
      }

      for (let i = player.bullets.length - 1; i >= 0; i--) {
           let b = player.bullets[i]; let hit = false;
           // Minions collision
           for(let j=enemies.length-1; j>=0; j--) {
               if(p.dist(b.pos.x, b.pos.y, enemies[j].pos.x, enemies[j].pos.y) < enemies[j].radius) {
                   enemies[j].hp -= b.dmg;
                   if(enemies[j].hp<=0) {
                        createExplosion(enemies[j].pos.x, enemies[j].pos.y, COLORS.ENEMY, 10);
                        score += enemies[j].scoreVal || 100; setScore(score);
                        if(p.random()<0.5) powerUps.push({x: enemies[j].pos.x, y: enemies[j].pos.y, type: p.random([1,2,3,4,5]), radius: 10, active: true});
                        enemies.splice(j,1);
                        SoundManager.playSFX('explosion');
                   } else {
                       SoundManager.playSFX('hit');
                   }
                   hit=true; break;
               }
           }
           if (!hit && boss.active && p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius) {
                if (boss.type === 'MATH' && boss.mathState !== 'SPIN' && boss.mathState !== 'RESOLVE') { createExplosion(b.pos.x, b.pos.y, [200,200,200], 2); hit = true; }
                else if (boss.type === 'MATH' && boss.mathState !== 'SPIN') { hit = true; } // Shielded
                else {
                    hit = true;
                    if (boss.shield > 0) {
                        boss.shield -= b.dmg * player.damageMult;
                        createExplosion(b.pos.x, b.pos.y, COLORS.BOSS_SHIELD, 3); // Shield hit feedback
                        SoundManager.playSFX('shield');
                    }
                    else {
                        boss.hp -= b.dmg * player.damageMult; setBossHealth((boss.hp/BOSS_MAX_HP)*100); score += SCORE_PER_HIT; setScore(score);
                        // HIT FLASH
                        boss.flashTimer = 3; 
                        SoundManager.playSFX('hit');
                        
                        while (boss.hp < boss.nextPowerUpHp) {
                             powerUps.push({ x: boss.pos.x, y: boss.pos.y, type: p.random([1,2,3,4,5]), radius: 10, active: true });
                             boss.nextPowerUpHp -= (BOSS_MAX_HP * 0.05);
                        }
                    }
                    if (boss.hp <= 0) { score += BOSS_SCORE_REWARD; setScore(score); setGameState(GameState.VICTORY); gameState = GameState.VICTORY; boss.active = false; SoundManager.stopBGM(); }
                }
           }
           if (hit) player.bullets.splice(i, 1);
      }
      
      if (stageTransitionTimer > 0) { stageTransitionTimer--; p.textAlign(p.CENTER, p.CENTER); p.textSize(40); p.fill(255, 0, 100, stageTransitionTimer * 2); p.text(`WARNING: LEVEL ${currentStageIndex + 1}`, p.width/2, p.height/2 - 50); }
    };

    p.startGame = (bossType) => { resetGame(bossType); gameState = GameState.PLAYING; };
  };
};
