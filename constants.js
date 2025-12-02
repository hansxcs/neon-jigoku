

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const PLAYER_SPEED = 5;
export const PLAYER_RADIUS = 8;
export const PLAYER_HITBOX = 4;

// --- GLOBAL BALANCE VARIABLES ---
export const BASE_BULLET_SPEED_SCALE = 1.0; // CHANGE THIS to globally speed up/slow down all enemy bullets
export const OVAL_BOSS_MOVE_SPEED = 4.0; 

export const BOSS_RADIUS = 40;
export const BOSS_SQUARE_SIZE = 60;
export const BOSS_TRIANGLE_SIZE = 50;
export const BOSS_HEXAGON_SIZE = 45;
export const BOSS_HOURGLASS_SIZE = 50;
export const BOSS_MATH_SIZE = 50;
export const BOSS_STAR_SIZE = 50; // New Star Size
export const BOSS_MAX_HP = 5000;
export const BOSS_SCORE_REWARD = 50000;
export const SCORE_PER_HIT = 10;

export const BULLET_SPEED = 7;
export const ENEMY_BULLET_BASE_SPEED = 2.5;

export const SHIELD_DURATION = 300; // 5 seconds at 60fps
export const MAX_SHIELD_CHARGES = 3;

export const COLORS = {
  PLAYER: [0, 255, 255], // Cyan
  PLAYER_SHIELD: [0, 100, 255, 100], // Transparent Blue
  PLAYER_BULLET: [200, 255, 255],
  
  BOSS_CIRCLE: [255, 0, 100], // Pink/Red
  BOSS_SQUARE: [255, 200, 0], // Gold/Orange
  BOSS_TRIANGLE: [0, 255, 100], // Neon Green
  BOSS_HEART: [255, 20, 100], // Deep Pink
  BOSS_OVAL: [150, 0, 255], // Neon Purple
  BOSS_HEXAGON: [0, 255, 255], // Electric Cyan
  BOSS_HOURGLASS: [218, 165, 32], // Golden Rod
  BOSS_MATH: [200, 200, 200], // Metallic White
  BOSS_STAR: [255, 220, 50], // Bright Yellow
  BOSS_GHOST: [218, 165, 32, 100], // Transparent Gold for Echo
  BOSS_SHADOW: [100, 100, 100, 150], // Dark Shadow Clone
  
  BOSS_BULLET_1: [255, 50, 50],
  BOSS_BULLET_2: [255, 150, 0],
  BOSS_BULLET_3: [255, 0, 255],
  BOSS_BULLET_SQUARE: [255, 255, 100],
  BOSS_BULLET_TRIANGLE: [100, 255, 150],
  BOSS_BULLET_HEART: [255, 100, 180],
  BOSS_BULLET_OVAL: [200, 100, 255],
  BOSS_BULLET_HEXAGON: [200, 255, 255],
  BOSS_BULLET_KNIFE: [192, 192, 192], // Silver
  BOSS_BULLET_SAND: [238, 232, 170], // Pale Goldenrod
  BOSS_BULLET_MATH: [50, 50, 255], // Math Blue
  BOSS_BULLET_MATH_HEAL: [0, 255, 0], // Green Heal
  BOSS_BULLET_MATRIX: [0, 255, 70], // Matrix Green
  BOSS_BULLET_BINARY: [0, 255, 100], // Bright Matrix Green
  BOSS_BULLET_GEOMETRY: [255, 100, 50], // Geometry Orange
  BOSS_BULLET_RIEMANN: [100, 100, 255], // Integral Blue
  BOSS_BULLET_MODULO: [180, 50, 255], // Modulo Purple
  BOSS_BULLET_FACTORIAL: [255, 69, 0], // Factorial Red-Orange
  BOSS_BULLET_STAR: [255, 255, 150], // Star Bullet Pale Yellow
  BOSS_MATH_GRID: [50, 50, 80, 50], // Faint Grid
  
  BOSS_LASER: [50, 255, 200],
  BOSS_SHIELD: [50, 150, 255], // Blue Shield
  BOSS_METEOR: [255, 255, 255], // Bright White
  BOSS_LIGHTNING: [50, 255, 255], // Electric Blue Lightning
  BOSS_PENDULUM: [205, 127, 50], // Bronze
  BOSS_STASIS_ORB: [100, 255, 255], // Cyan/White Glow
  BOSS_SAND_WALL: [184, 134, 11], // Dark Goldenrod
  BOSS_FATE_BEAM: [255, 215, 0], // Gold Laser
  BOSS_INEQUALITY: [255, 0, 0, 100], // Red Danger Zone
  BOSS_INEQUALITY_WARN: [255, 200, 0, 100], // Yellow Warning Zone

  ENEMY: [255, 80, 80], // Light Red
  ENEMY_BULLET: [255, 150, 150],
  ENEMY_ORBITER: [100, 255, 255],
  ENEMY_MINI_BOSS: [50, 200, 100],
  ENEMY_LUST_ORB: [200, 0, 200],

  POWERUP_SPREAD: [0, 255, 100], // Green
  POWERUP_RAPID: [255, 255, 0],   // Yellow
  POWERUP_HOMING: [150, 100, 255], // Purple
  POWERUP_HEAL: [255, 100, 150], // Pink
  POWERUP_SHIELD: [0, 200, 255], // Cyan Blue
  POWERUP_TRAP: [80, 0, 0], // Dark Red Glitch
  
  BLOCKER: [0, 200, 255], // Cyan Blue for blocker fields
  TIME_FREEZE_OVERLAY: [200, 200, 255, 50], // Overlay during time stop

  BACKGROUND: 10
};

export const STAGES = 5;
export const MAX_WEAPON_LEVEL = 3;
