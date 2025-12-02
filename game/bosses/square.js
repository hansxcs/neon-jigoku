


import { COLORS, BOSS_SQUARE_SIZE } from '../../constants.js';
import { Patterns } from '../patterns.js';
import p5 from 'p5';

export const SquareBoss = {
    type: 'SQUARE',
    color: COLORS.BOSS_SQUARE,

    init: (boss) => {
        boss.dashState = 'IDLE';
        boss.dashTimer = 0;
        boss.targetPos = null;
        boss.currentVel = {x: 0, y: 0}; // For tracking visual velocity
    },

    onStageChange: (boss, stage) => {
        // No specific stage init
    },

    drawIntro: (p, boss, introProgress, triggerEffect) => {
        // Falls from top
        let yOffset = -500 * (1 - introProgress);
        p.translate(0, yOffset);
        
        p.fill(...COLORS.BOSS_SQUARE); p.stroke(255);
        p.rectMode(p.CENTER);
        p.rect(0, 0, BOSS_SQUARE_SIZE, BOSS_SQUARE_SIZE);
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, blockers, particles, stageTransitionTimer } = data;

        boss.angle += 0.02;

        let prevPos = boss.pos.copy();

        // Dash State Machine
        switch(boss.dashState) {
            case 'IDLE':
                boss.pos.x = p.lerp(boss.pos.x, p.width/2 + Math.sin(frame * 0.01) * 100, 0.05);
                boss.pos.y = p.lerp(boss.pos.y, 100 + Math.cos(frame * 0.03) * 20, 0.05);
                if (stage >= 1 && p.random() < 0.01) {
                     boss.dashState = 'CHARGE';
                     boss.dashTimer = 60;
                     // Trap Player
                     const trapSize = 250;
                     const wallThick = 20;
                     const px = player.pos.x;
                     const py = player.pos.y;
                     blockers.push({ pos: p.createVector(px, py - trapSize/2), w: trapSize, h: wallThick });
                     blockers.push({ pos: p.createVector(px, py + trapSize/2), w: trapSize, h: wallThick });
                     blockers.push({ pos: p.createVector(px - trapSize/2, py), w: wallThick, h: trapSize });
                     blockers.push({ pos: p.createVector(px + trapSize/2, py), w: wallThick, h: trapSize });
                }
                break;
            case 'CHARGE':
                boss.dashTimer--;
                boss.pos.x += p.random(-2, 2);
                boss.pos.y += p.random(-2, 2);
                p.stroke(255, 0, 0, 100);
                p.line(boss.pos.x, boss.pos.y, player.pos.x, player.pos.y);
                if (boss.dashTimer <= 0) {
                    boss.dashState = 'DASH';
                    boss.dashTimer = 30;
                    let v = p5.Vector.sub(player.pos, boss.pos);
                    v.setMag(15);
                    boss.targetPos = v;
                }
                break;
            case 'DASH':
                boss.dashTimer--;
                boss.pos.add(boss.targetPos);
                particles.push({
                     x: boss.pos.x, y: boss.pos.y,
                     vx: p.random(-1,1), vy: p.random(-1,1),
                     life: 0.5, color: COLORS.BOSS_SQUARE, size: 20
                });
                if (boss.dashTimer <= 0) {
                    boss.dashState = 'RECOVER';
                    boss.dashTimer = 60;
                }
                break;
            case 'RECOVER':
                boss.dashTimer--;
                boss.pos.x = p.lerp(boss.pos.x, p.width/2, 0.05);
                boss.pos.y = p.lerp(boss.pos.y, 100, 0.05);
                if (boss.dashTimer <= 0) {
                    boss.dashState = 'IDLE';
                    // Clear blockers
                    blockers.length = 0; 
                }
                break;
        }
        
        // Calc visual velocity for shear effect
        boss.currentVel.x = boss.pos.x - prevPos.x;
        boss.currentVel.y = boss.pos.y - prevPos.y;

        if (stageTransitionTimer < 140 && boss.dashState !== 'DASH') {
            if (stage >= 0) if (frame % 8 === 0) Patterns.squareSpiral(p, boss.pos, frame, spawnBullet, baseSpeed);
            if (stage >= 1) if (frame % 40 === 0) Patterns.rapidStream(p, boss.pos, player.pos, spawnBullet, baseSpeed + 3);
            if (stage >= 2) if (frame % 100 === 0) Patterns.wallDown(p, p.width, spawnBullet, baseSpeed * 0.8);
            if (stage >= 3) if (frame % 30 === 0) Patterns.spread(p, boss.pos, player.pos, 7, p.PI/2, spawnBullet, baseSpeed);
            if (stage >= 4) if (frame % 10 === 0) Patterns.chaos(p, boss.pos, spawnBullet, baseSpeed + 2);
        }
    },

    draw: (p, boss, frame) => {
        if (boss.flashTimer > 0) { p.fill(255); p.stroke(255); }
        else { p.fill(...COLORS.BOSS_SQUARE); p.stroke(...COLORS.BOSS_SQUARE); }
        
        p.rectMode(p.CENTER);
        
        // Shear/Distortion Animation based on movement
        p.push();
        let shearAmt = p.constrain(boss.currentVel.x * 0.05, -0.5, 0.5);
        p.shearX(shearAmt);
        
        p.rect(0, 0, BOSS_SQUARE_SIZE, BOSS_SQUARE_SIZE);
        
        // Inner spinning square
        if (boss.flashTimer <= 0) {
            p.noFill(); p.stroke(255, 150); p.strokeWeight(2);
            p.rotate(-boss.angle * 2);
            p.rect(0, 0, BOSS_SQUARE_SIZE * 0.6, BOSS_SQUARE_SIZE * 0.6);
        }
        p.pop();

        // Forcefield Visual
        p.noFill(); p.stroke(255, 100); p.strokeWeight(1);
        p.rect(0, 0, BOSS_SQUARE_SIZE + 20 + Math.sin(frame*0.1)*10, BOSS_SQUARE_SIZE + 20 + Math.sin(frame*0.1)*10);
    }
};
