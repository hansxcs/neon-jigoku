
import { COLORS } from '../../constants.js';
import { Patterns } from '../patterns.js';
import { drawGlitch } from '../utils.js';

export const HourglassBoss = {
    type: 'HOURGLASS',
    color: COLORS.BOSS_HOURGLASS,

    init: (boss) => {
        boss.timeAbilityTimer = 300;
        boss.timeState = 'NORMAL';
        boss.targetAngle = 0;
        boss.history = [];
        boss.pendulum = { phase: 0, angle: 0, length: 450, bobR: 35 };
        boss.fateBeams = [];
    },

    onStageChange: (boss, stage) => {
        if (stage >= 4) {
            // Activate Dual Fate Beams
            boss.fateBeams = [
                { active: false, x: 0, width: 0, damage: 2, orientation: 'V' },
                { active: false, y: 0, width: 0, damage: 2, orientation: 'H' }
            ];
        }
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, createExplosion, spawnStasisOrb, enemyBullets, particles, setHealth, stageTransitionTimer, globalTimeScale } = data;

        boss.pos.x = p.width / 2 + Math.sin(frame * 0.01) * 100;
        boss.pos.y = 120 + Math.cos(frame * 0.02) * 20;

        // History for Echo
        boss.history.push({ x: boss.pos.x, y: boss.pos.y, angle: boss.angle });
        if (boss.history.length > 30) boss.history.shift();

        // --- PENDULUM (Stage 2+) ---
        if (stage >= 1) {
            boss.pendulum.phase += 0.03 * globalTimeScale;
            boss.pendulum.angle = Math.sin(boss.pendulum.phase) * (Math.PI/4);

            // Draw Pendulum
            p.push();
            p.translate(p.width/2, -50);
            p.rotate(boss.pendulum.angle);
            
            p.stroke(...COLORS.BOSS_PENDULUM); p.strokeWeight(4);
            p.line(0, 0, 0, boss.pendulum.length);

            // Sand Trail
            if (globalTimeScale > 0 && frame % 5 === 0) {
                 const worldX = p.width/2 - Math.sin(boss.pendulum.angle) * boss.pendulum.length;
                 const worldY = -50 + Math.cos(boss.pendulum.angle) * boss.pendulum.length;
                 spawnBullet(worldX, worldY, p.random(-0.2, 0.2), 0.5, baseSpeed, COLORS.BOSS_BULLET_SAND, 'CIRCLE');
            }
            
            // Draw Bob
            p.translate(0, boss.pendulum.length);
            p.fill(200); p.stroke(255); p.strokeWeight(2);
            p.beginShape();
            p.vertex(0, -boss.pendulum.bobR);
            p.bezierVertex(boss.pendulum.bobR*1.5, 0, boss.pendulum.bobR*1.5, boss.pendulum.bobR, 0, boss.pendulum.bobR*1.5);
            p.bezierVertex(-boss.pendulum.bobR*1.5, boss.pendulum.bobR, -boss.pendulum.bobR*1.5, 0, 0, -boss.pendulum.bobR);
            p.endShape(p.CLOSE);
            
            // Collision
            const bladeWorldX = p.width/2 - Math.sin(boss.pendulum.angle) * boss.pendulum.length;
            const bladeWorldY = -50 + Math.cos(boss.pendulum.angle) * boss.pendulum.length;
            
            if (p.dist(bladeWorldX, bladeWorldY, player.pos.x, player.pos.y) < boss.pendulum.bobR + player.hitbox && player.invulnerable <= 0 && player.shieldTimer <= 0) {
                 player.hp -= 35; 
                 setHealth(player.hp);
                 player.invulnerable = 90;
                 createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 15);
            }
            p.pop();
        }

        // --- STASIS ORBS (Stage 3+) ---
        if (stage >= 2 && globalTimeScale > 0 && frame % 180 === 0) {
            spawnStasisOrb();
        }

        // --- FATE BEAM (Stage 5) ---
        if (stage >= 4) {
             if (frame % 300 === 0 && globalTimeScale > 0) {
                boss.fateBeams.forEach(b => {
                    b.active = true;
                    b.width = 0;
                    if (b.orientation === 'V') b.x = p.random(50, p.width - 50);
                    if (b.orientation === 'H') b.y = p.random(50, p.height - 50);
                });
            }
            
            boss.fateBeams.forEach(beam => {
                if (beam.active) {
                    beam.width += 2 * globalTimeScale;
                    const maxWidth = 80;
                    p.noStroke();
                    p.fill(COLORS.BOSS_FATE_BEAM[0], COLORS.BOSS_FATE_BEAM[1], COLORS.BOSS_FATE_BEAM[2], 100);
                    
                    if (beam.orientation === 'V') {
                         p.rect(beam.x - beam.width/2, 0, beam.width, p.height);
                         p.fill(255, 200); p.rect(beam.x - beam.width/6, 0, beam.width/3, p.height);
                    } else {
                         p.rect(0, beam.y - beam.width/2, p.width, beam.width);
                         p.fill(255, 200); p.rect(0, beam.y - beam.width/6, p.width, beam.width/3);
                    }

                    if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
                        let hit = false;
                        if (beam.orientation === 'V') { if (Math.abs(player.pos.x - beam.x) < beam.width/2) hit = true; } 
                        else { if (Math.abs(player.pos.y - beam.y) < beam.width/2) hit = true; }
                        if (hit) {
                            player.hp -= beam.damage;
                            setHealth(player.hp);
                            createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1);
                        }
                    }
                    if (beam.width > maxWidth) beam.active = false;
                }
            });
        }

        // --- TIME CONTROL LOGIC ---
        // Returns the desired Global Time Scale to the main loop
        let nextTimeScale = globalTimeScale;

        if (stage >= 2) {
            boss.timeAbilityTimer--;
            
            // Trigger Stop
            if (boss.timeAbilityTimer <= 0 && boss.timeState === 'NORMAL') {
                boss.timeState = 'STOPPED';
                boss.timeAbilityTimer = 60; // 1 second stop
                boss.targetAngle += p.PI;
                nextTimeScale = 0;
                player.frozen = true;
                particles.push({x: boss.pos.x, y: boss.pos.y, vx: 0, vy: 0, life: 1.0, color: COLORS.BOSS_HOURGLASS, size: 200, isShockwave: true});
                drawGlitch(p);
                
                // Spawn Frozen Rain
                for(let x=20; x<p.width; x+=40) {
                    spawnBullet(x, -20, 0, 2, baseSpeed, COLORS.BOSS_BULLET_SAND, 'CIRCLE');
                }

                // Spawn Time Ripple (Immediate surrounding threat)
                Patterns.ring(p, boss.pos, 24, (x,y,vx,vy,s,c) => spawnBullet(x,y,vx,vy,s,c,'CIRCLE'), baseSpeed * 1.5);
                
                // Freeze Bullets and Aim at Player
                enemyBullets.forEach(b => {
                    b.shape = 'KNIFE';
                    b.color = COLORS.BOSS_BULLET_KNIFE;
                    b.r = 8;
                    const a = Math.atan2(player.pos.y - b.pos.y, player.pos.x - b.pos.x);
                    b.angle = a;
                    b.vel.mult(0);
                });
            } 
            // Resume
            else if (boss.timeAbilityTimer <= 0 && boss.timeState === 'STOPPED') {
                boss.timeState = 'NORMAL';
                boss.timeAbilityTimer = 300;
                boss.targetAngle += p.PI;
                nextTimeScale = 1.0;
                player.frozen = false;
                drawGlitch(p);
                
                // Resume Bullets - Launch them AT the player
                enemyBullets.forEach(b => {
                    if (b.shape === 'KNIFE') {
                        // Re-aim at player's current position for aggression
                        const a = Math.atan2(player.pos.y - b.pos.y, player.pos.x - b.pos.x);
                        b.angle = a;
                        b.vel.x = Math.cos(a) * baseSpeed * 3;
                        b.vel.y = Math.sin(a) * baseSpeed * 3;
                    } else if (b.pos.y < 0) {
                        b.vel.y = baseSpeed * 2;
                    }
                });
            }
        }
        
        // --- SAND GEYSERS ---
        if (stage >= 3 && frame % 150 === 0 && nextTimeScale > 0) {
            Patterns.sandGeyser(p, p.width, p.height, spawnBullet, baseSpeed);
        }

        // --- PATTERNS ---
        if (stageTransitionTimer < 140 && boss.timeState === 'NORMAL') {
            let ghostPos = null;
            if (stage >= 3 && boss.history.length > 30) {
                 let record = boss.history[boss.history.length - 30];
                 ghostPos = p.createVector(record.x, record.y);
            }
            
            const sources = [boss.pos];
            if (stage >= 4) sources.push(p.createVector(p.width - boss.pos.x, boss.pos.y)); // Shadow

            sources.forEach((source, index) => {
                const c = index === 1 ? COLORS.BOSS_SHADOW : undefined;
                if (stage >= 0 && frame % 60 === 0) Patterns.hourglassSplash(p, source, frame, (x,y,vx,vy,s,cl,sh,b) => spawnBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                if (stage >= 1 && frame % 120 === 0) Patterns.sandstorm(p, source, p.width, (x,y,vx,vy,s,cl,sh,b) => spawnBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                if (stage >= 2 && frame % 5 === 0 && p.random() < 0.2) Patterns.aimed(p, source, player.pos, (x,y,vx,vy,s,cl,sh,b) => spawnBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                if (stage >= 3 && frame % 40 === 0) Patterns.ring(p, source, 10, (x,y,vx,vy,s,cl,sh,b) => spawnBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
            });
            
            if (ghostPos) {
                 Patterns.hourglassSplash(p, ghostPos, frame - 30, (x,y,vx,vy,s,c,sh,b) => spawnBullet(x,y,vx,vy,s,COLORS.BOSS_GHOST,sh,b), baseSpeed);
            }
            if (stage >= 4 && frame % 90 === 0) Patterns.timelineCollapse(p, p.width, p.height, spawnBullet, baseSpeed);
        }

        return nextTimeScale;
    },

    draw: (p, boss, frame) => {
        // Interpolate Angle Smoother
        boss.angle = p.lerp(boss.angle, boss.targetAngle, 0.05);
        
        const drawHourglass = (offsetX = 0, offsetY = 0, color = COLORS.BOSS_HOURGLASS) => {
            p.push();
            p.translate(offsetX, offsetY);
            
            // Top Bulb
            p.noFill(); 
            p.stroke(...color); 
            p.strokeWeight(4);
            p.triangle(-30, -50, 30, -50, 0, 0);
            p.triangle(-30, 50, 30, 50, 0, 0);
            
            // Sand
            p.noStroke(); p.fill(255, 215, 0);
            let sandLevelTop = 10 + Math.sin(frame * 0.05) * 5;
            let sandLevelBot = 10 + frame % 40; 
            if (boss.timeState === 'STOPPED') p.fill(100); 
            p.triangle(-20, -40, 20, -40, 0, -5); 
            p.triangle(-20, 45, 20, 45, 0, 45 - sandLevelBot*0.5); 
            
            if (boss.timeState !== 'STOPPED') {
                p.stroke(255, 215, 0); p.strokeWeight(2);
                p.line(0, -5, 0, 45);
            }
            p.pop();
        };

        if (boss.timeState === 'STOPPED') {
            // Chromatic Aberration Effect
            p.drawingContext.save();
            p.drawingContext.globalCompositeOperation = 'screen';
            // Cyan Channel
            drawHourglass(p.random(-2,2), p.random(-2,2), [0, 255, 255]);
            // Magenta Channel
            drawHourglass(p.random(-2,2), p.random(-2,2), [255, 0, 255]);
            p.drawingContext.restore();
        } else {
            drawHourglass(0, 0, COLORS.BOSS_HOURGLASS);
        }
    }
};
