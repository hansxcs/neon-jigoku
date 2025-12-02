
import { COLORS, BOSS_STAR_SIZE } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const StarBoss = {
    type: 'STAR',
    color: COLORS.BOSS_STAR,

    init: (boss) => {
        boss.starAngle = 0;
        boss.pulse = 0;
        boss.shield = 0;
        boss.maxShield = 0;
    },

    onStageChange: (boss, stage) => {
        // Cumulative Shield: Stage 1=100, 2=200, 3=300...
        const shieldAmt = (stage + 1) * 100;
        boss.maxShield = shieldAmt;
        boss.shield = shieldAmt;
    },

    drawIntro: (p, boss, introProgress, triggerEffect) => {
        // Smooth scale up, with spin-up effect
        p.scale(introProgress);
        
        // Spin-up: Exponential rotation speed
        const rot = Math.pow(introProgress, 3) * p.TWO_PI * 5; 
        p.rotate(rot);
        
        p.fill(...COLORS.BOSS_STAR); p.noStroke();
        
        // Draw Star
        const angle = p.TWO_PI / 5;
        const halfAngle = angle / 2.0;
        p.beginShape();
        for (let a = 0; a < p.TWO_PI; a += angle) {
            let sx = Math.cos(a) * BOSS_STAR_SIZE;
            let sy = Math.sin(a) * BOSS_STAR_SIZE;
            p.vertex(sx, sy);
            sx = Math.cos(a + halfAngle) * (BOSS_STAR_SIZE/2);
            sy = Math.sin(a + halfAngle) * (BOSS_STAR_SIZE/2);
            p.vertex(sx, sy);
        }
        p.endShape(p.CLOSE);
        
        // Shine
        p.stroke(255, 150 * introProgress); p.strokeWeight(2);
        p.line(0, -BOSS_STAR_SIZE*1.5, 0, BOSS_STAR_SIZE*1.5);
        p.line(-BOSS_STAR_SIZE*1.5, 0, BOSS_STAR_SIZE*1.5, 0);
        
        // Flash at peak
        if (introProgress > 0.95 && p.frameCount % 5 === 0) triggerEffect('FLASH', 30);
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, stageTransitionTimer } = data;

        // Faster rotation
        boss.starAngle += 0.04; 
        boss.pos.x = p.width / 2 + Math.cos(frame * 0.015) * 80;
        boss.pos.y = 150 + Math.sin(frame * 0.02) * 30;

        if (stageTransitionTimer < 140) {
            // Stage 1: Star Stream - Consistent every 4 frames
            if (stage >= 0) {
                if (frame % 4 === 0) Patterns.starRadial(p, boss.pos, frame, 10, spawnBullet, baseSpeed * 1.2);
            }
            
            // Stage 2: Galaxy Spiral - Consistent every 6 frames
            if (stage >= 1) {
                if (frame % 6 === 0) Patterns.starSpiral(p, boss.pos, frame * 1.5, 16, spawnBullet, baseSpeed);
            }
            
            // Stage 3: Star Wave - Consistent every 8 frames
            if (stage >= 2) {
                if (frame % 8 === 0) {
                    Patterns.starWave(p, boss.pos, frame, spawnBullet, baseSpeed * 1.5);
                }
            }
            
            // Stage 4: Star Mandala - Continuous call for internal pacing (inside pattern) or consistent call
            if (stage >= 3) {
                // Ensure pattern is called frequently enough to trigger its internal logic or just force it
                // Using frame check here to align with other patterns
                if (frame % 4 === 0) Patterns.starMandala(p, boss.pos, frame, spawnBullet, baseSpeed * 0.8);
                
                // Shape Explosion - Periodic burst
                if (frame % 120 === 0) Patterns.starShape(p, boss.pos, frame, spawnBullet, baseSpeed);
            }
            
            // Stage 5: Supernova - High Density Rhythm
            if (stage >= 4) {
                // Interleave patterns without gaps
                if (frame % 16 === 0) Patterns.starMandala(p, boss.pos, frame, spawnBullet, baseSpeed * 0.8);
                if (frame % 12 === 0) Patterns.starWave(p, boss.pos, frame, spawnBullet, baseSpeed * 1.2);
                
                // Pulse dense ring
                if (frame % 60 === 0) {
                    Patterns.ring(p, boss.pos, 60, spawnBullet, baseSpeed * 0.6);
                }
            }
        }
    },

    draw: (p, boss, frame) => {
        // Shield Ring
        if (boss.shield > 0) {
            p.push();
            p.rotate(frame * 0.05); // Shield spins independently
            p.noFill();
            p.stroke(...COLORS.BOSS_SHIELD);
            p.strokeWeight(4);
            // Draw broken ring based on %
            const pct = boss.shield / boss.maxShield;
            const len = p.TWO_PI * pct;
            p.arc(0, 0, BOSS_STAR_SIZE * 3.5, BOSS_STAR_SIZE * 3.5, -p.PI/2, -p.PI/2 + len);
            p.pop();
        }

        p.rotate(boss.starAngle);
        
        if (boss.flashTimer > 0) { p.fill(255); p.stroke(255); }
        else { p.fill(...COLORS.BOSS_STAR); p.stroke(255, 100); }
        
        p.strokeWeight(2);
        
        // Draw Star
        const angle = p.TWO_PI / 5;
        const halfAngle = angle / 2.0;
        p.beginShape();
        for (let a = 0; a < p.TWO_PI; a += angle) {
            let sx = Math.cos(a) * BOSS_STAR_SIZE;
            let sy = Math.sin(a) * BOSS_STAR_SIZE;
            p.vertex(sx, sy);
            sx = Math.cos(a + halfAngle) * (BOSS_STAR_SIZE/2);
            sy = Math.sin(a + halfAngle) * (BOSS_STAR_SIZE/2);
            p.vertex(sx, sy);
        }
        p.endShape(p.CLOSE);
        
        // Inner spinning star (small)
        if (boss.flashTimer <= 0) {
            p.fill(255, 200); p.noStroke();
            p.rotate(-boss.starAngle * 2);
            p.scale(0.4);
            p.beginShape();
            for (let a = 0; a < p.TWO_PI; a += angle) {
                let sx = Math.cos(a) * BOSS_STAR_SIZE;
                let sy = Math.sin(a) * BOSS_STAR_SIZE;
                p.vertex(sx, sy);
                sx = Math.cos(a + halfAngle) * (BOSS_STAR_SIZE/2);
                sy = Math.sin(a + halfAngle) * (BOSS_STAR_SIZE/2);
                p.vertex(sx, sy);
            }
            p.endShape(p.CLOSE);
        }
    }
};
