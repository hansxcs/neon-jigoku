
import { COLORS, BOSS_RADIUS } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const HeartBoss = {
    type: 'HEART',
    color: COLORS.BOSS_HEART,

    init: (boss) => {
        boss.shield = 0;
        boss.maxShield = 2000;
    },

    onStageChange: (p, boss, stage, spawnMinion) => {
        if (stage === 3) { // Stage 4: Lust Orbs
            spawnMinion('lust_orb', 100, 100);
            spawnMinion('lust_orb', p.width - 100, 100);
        }
        if (stage === 4) { // Stage 5: Shield + Grow
            boss.shield = boss.maxShield;
            boss.radius = BOSS_RADIUS * 1.5;
        }
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, stageTransitionTimer } = data;

        boss.pos.x = p.width / 2 + Math.sin(frame * 0.02) * 100;
        boss.pos.y = 120 + Math.sin(frame * 0.04) * 30;

        if (stageTransitionTimer < 140) {
            if (stage >= 0) if (frame % 60 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnBullet, baseSpeed);
            if (stage >= 1) if (frame % 60 === 0) Patterns.pantyShot(p, boss.pos, player.pos, spawnBullet, baseSpeed + 1);
            if (stage >= 2) if (frame % 5 === 0) Patterns.magazineStream(p, boss.pos, frame, spawnBullet, baseSpeed + 2);
            if (stage >= 3) if (frame % 40 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnBullet, baseSpeed);
            if (stage >= 4) {
                 if (frame % 20 === 0) Patterns.chaos(p, boss.pos, spawnBullet, baseSpeed + 3);
                 if (frame % 90 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnBullet, baseSpeed);
                 if (frame % 15 === 0) Patterns.magazineCross(p, boss.pos, frame, spawnBullet, baseSpeed + 2);
            }
        }
    },

    draw: (p, boss, frame) => {
        // Draw Heart Shape
        p.beginShape();
        for (let t = 0; t < p.TWO_PI; t += 0.1) {
            let r = 2; // scale
            // If shield active, it's bigger physically (handled by radius in logic, visual scale here)
            if (boss.shield > 0) r = 3; 
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)); 
            p.vertex(x * r, y * r);
        }
        p.endShape(p.CLOSE);

        // Shield Bar
        if (boss.shield > 0) {
              p.push();
              p.translate(boss.pos.x, boss.pos.y); // Actually we are already translated in sketch draw loop
              // Wait, the Boss draw is called inside push/pop translate in sketch.
              // So we are at (0,0) relative to boss.
              p.noFill();
              p.stroke(COLORS.BOSS_SHIELD);
              p.strokeWeight(4);
              p.arc(0, 0, 140, 140, -p.PI/2, -p.PI/2 + (p.TWO_PI * (boss.shield/boss.maxShield)));
              p.noStroke();
              p.pop();
        }
    }
};
