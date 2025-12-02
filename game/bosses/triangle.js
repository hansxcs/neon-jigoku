

import { COLORS, BOSS_TRIANGLE_SIZE, PLAYER_HITBOX } from '../../constants.js';
import { Patterns } from '../patterns.js';
import { lineCircleIntersect } from '../utils.js';

export const TriangleBoss = {
    type: 'TRIANGLE',
    color: COLORS.BOSS_TRIANGLE,

    init: (boss) => {
        boss.summonTimer = 0;
        boss.teleportState = 'IDLE';
        boss.teleportTimer = 0;
        boss.opacity = 255;
        boss.laserPhase = 'COOLDOWN';
        boss.laserTimer = 120;
    },

    onStageChange: (boss, stage) => {
        // No specific init
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, spawnMinion, enemies, setHealth, createExplosion, stageTransitionTimer } = data;

        boss.angle -= 0.02; 
        boss.summonTimer++;

        // Teleport Logic
        if (boss.teleportState === 'IDLE') {
            boss.pos.x = p.width / 2 + Math.sin(frame * 0.03) * 200;
            boss.pos.y = 80 + Math.abs(Math.sin(frame * 0.04)) * 50;
            if (frame % 300 === 0) {
                boss.teleportState = 'OUT';
                boss.teleportTimer = 30;
            }
        } else if (boss.teleportState === 'OUT') {
            boss.opacity -= 8;
            if (boss.opacity <= 0) {
                boss.opacity = 0;
                boss.teleportState = 'WAIT';
                boss.teleportTimer = 20;
                boss.pos.x = p.random(100, p.width - 100);
                boss.pos.y = p.random(50, 200);
            }
        } else if (boss.teleportState === 'WAIT') {
            boss.teleportTimer--;
            if (boss.teleportTimer <= 0) boss.teleportState = 'IN';
        } else if (boss.teleportState === 'IN') {
            boss.opacity += 8;
            if (boss.opacity >= 255) {
                boss.opacity = 255;
                boss.teleportState = 'IDLE';
            }
        }

        // Prism Lasers (Stage 3+)
        if (stage >= 2 && boss.opacity > 200) {
            boss.laserTimer--;
            if (boss.laserTimer <= 0) {
                if (boss.laserPhase === 'COOLDOWN') {
                    boss.laserPhase = 'CHARGE';
                    boss.laserTimer = 60; 
                } else if (boss.laserPhase === 'CHARGE') {
                    boss.laserPhase = 'FIRE';
                    boss.laserTimer = 90; 
                } else {
                    boss.laserPhase = 'COOLDOWN';
                    boss.laserTimer = 120;
                }
            }

            if (boss.laserPhase !== 'COOLDOWN') {
                const s = BOSS_TRIANGLE_SIZE;
                for(let i=0; i<3; i++) {
                    const angle = boss.angle + (p.TWO_PI/3)*i - p.PI/2;
                    const vx = boss.pos.x + Math.cos(angle) * s;
                    const vy = boss.pos.y + Math.sin(angle) * s;
                    const laserLen = 1000;
                    const lx = vx + Math.cos(angle) * laserLen;
                    const ly = vy + Math.sin(angle) * laserLen;
                    
                    if (boss.laserPhase === 'CHARGE') {
                        p.stroke(COLORS.BOSS_LASER[0], COLORS.BOSS_LASER[1], COLORS.BOSS_LASER[2], 100);
                        p.strokeWeight(2);
                        p.drawingContext.setLineDash([10, 10]); 
                        p.line(vx, vy, lx, ly);
                        p.drawingContext.setLineDash([]);
                    } else if (boss.laserPhase === 'FIRE') {
                        if (Array.isArray(COLORS.BOSS_LASER)) p.stroke(...COLORS.BOSS_LASER); else p.stroke(COLORS.BOSS_LASER);
                        p.strokeWeight(6);
                        p.line(vx, vy, lx, ly);
                        p.strokeWeight(2);
                        p.stroke(255);
                        p.line(vx, vy, lx, ly);
                        if (lineCircleIntersect(vx, vy, lx, ly, player.pos.x, player.pos.y, PLAYER_HITBOX + 6)) {
                            if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
                                player.hp -= 3;
                                setHealth(player.hp);
                                createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1);
                            }
                        }
                    }
                }
            }
            
            // Prism Prison (Stage 4+)
            if (stage >= 3 && frame % 400 === 0) {
                 const r = 300;
                 for(let k=0; k<3; k++) {
                     let a = k * (p.TWO_PI/3) + frame*0.01;
                     let nx = player.pos.x + Math.cos(a)*r;
                     let ny = player.pos.y + Math.sin(a)*r;
                     spawnBullet(nx, ny, (player.pos.x - nx)*0.005, (player.pos.y - ny)*0.005, baseSpeed * 0.8, COLORS.BOSS_LASER, 'CIRCLE');
                 }
            }
        }

        // Patterns & Summoning
        if (stageTransitionTimer < 140 && boss.opacity > 200) {
            if (frame % 30 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnBullet, baseSpeed + 4); 
            if (stage >= 0) {
                if (boss.summonTimer % 60 === 0) { 
                    spawnMinion('drone', boss.pos.x + 50, boss.pos.y);
                    spawnMinion('drone', boss.pos.x - 50, boss.pos.y);
                }
            }
            if (stage >= 1) {
                if (boss.summonTimer % 90 === 45) spawnMinion('swooper', boss.pos.x, boss.pos.y + 50); 
                if (frame % 40 === 0) Patterns.spread(p, boss.pos, player.pos, 3, p.PI/4, spawnBullet, baseSpeed);
            }
            if (stage >= 2) {
                 if (boss.summonTimer % 120 === 60) { 
                     for(let i=0; i<3; i++) spawnMinion('orbiter', boss.pos.x, boss.pos.y, boss);
                 }
            }
            if (stage >= 3) {
                 const miniBossCount = enemies.filter(e => e.type === 'mini_boss').length;
                 if (miniBossCount < 3 && boss.summonTimer % 150 === 0) spawnMinion('mini_boss', boss.pos.x, boss.pos.y); 
            }
            if (stage >= 4) {
                 if (frame % 5 === 0) Patterns.flower(p, boss.pos, frame, 5, spawnBullet, baseSpeed); 
                 if (boss.summonTimer % 40 === 0) spawnMinion(p.random(['drone', 'swooper'])); 
            }
        }
    },

    draw: (p, boss, frame) => {
        // Outer Triangle
        p.beginShape();
        for(let i=0; i<3; i++) {
            let a = (p.TWO_PI/3) * i - p.PI/2;
            p.vertex(Math.cos(a) * BOSS_TRIANGLE_SIZE, Math.sin(a) * BOSS_TRIANGLE_SIZE);
        }
        p.endShape(p.CLOSE);
        // Inner Spinning Triangle
        p.noFill(); p.stroke(255); p.strokeWeight(1);
        p.rotate(frame * 0.05);
        p.beginShape();
        for(let i=0; i<3; i++) {
            let a = (p.TWO_PI/3) * i - p.PI/2;
            p.vertex(Math.cos(a) * (BOSS_TRIANGLE_SIZE/2), Math.sin(a) * (BOSS_TRIANGLE_SIZE/2));
        }
        p.endShape(p.CLOSE);
    }
};