
export const GameState = {
  MENU: 0,
  PLAYING: 1,
  VICTORY: 2,
  GAME_OVER: 3
};

export const WeaponType = {
  DEFAULT: 0,
  SPREAD: 1,
  RAPID: 2,
  HOMING: 3
};

export const PowerUpType = {
  SPREAD: 1, // Matches WeaponType.SPREAD
  RAPID: 2,  // Matches WeaponType.RAPID
  HOMING: 3, // Matches WeaponType.HOMING
  HEAL: 4
};
