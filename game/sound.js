
export const SoundManager = {
  bgm: null,
  sfx: {},
  muted: false,
  initialized: false,

  init: () => {
    if (SoundManager.initialized) return;

    // Map keys to filenames. Assumes files exist in /public/sounds/
    const sfxFiles = {
      shoot: 'shoot.wav',
      hit: 'hit.wav',
      explosion: 'explosion.wav',
      shield: 'shield.wav',
      powerup: 'powerup.wav',
      alert: 'alert.wav'
    };

    // Preload SFX
    for (const [key, file] of Object.entries(sfxFiles)) {
      // Use standard path; browsers will 404 silently in console if missing
      // but the app won't crash due to try/catch in play
      const audio = new Audio(`/sounds/${file}`);
      audio.volume = 0.3; // Default SFX volume
      SoundManager.sfx[key] = audio;
    }
    
    SoundManager.initialized = true;
  },

  playBGM: (bossType) => {
    if (SoundManager.muted) return;
    
    // Stop previous BGM
    SoundManager.stopBGM();
    
    // Construct path based on boss type or fallback to generic
    // Map specific bosses to tracks if needed, otherwise generic convention
    const trackName = `bgm_${bossType.toLowerCase()}.mp3`;
    const audio = new Audio(`/sounds/${trackName}`);
    
    audio.loop = true;
    audio.volume = 0.4; // Default BGM volume
    
    // Attempt playback
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            // Auto-play policy or missing file
            console.warn(`BGM '${trackName}' could not be played:`, error);
        });
    }
    
    SoundManager.bgm = audio;
  },
  
  stopBGM: () => {
    if (SoundManager.bgm) {
      SoundManager.bgm.pause();
      SoundManager.bgm.currentTime = 0;
      SoundManager.bgm = null;
    }
  },

  playSFX: (key) => {
    if (SoundManager.muted || !SoundManager.sfx[key]) return;
    
    // Clone node to allow polyphony (overlapping sounds)
    try {
        const sound = SoundManager.sfx[key].cloneNode();
        sound.volume = SoundManager.sfx[key].volume;
        sound.play().catch(() => {
            // Ignore errors (common if user hasn't interacted with DOM yet)
        });
    } catch (e) {
        console.warn("Error playing SFX:", e);
    }
  },
  
  toggleMute: () => {
      SoundManager.muted = !SoundManager.muted;
      if (SoundManager.muted) SoundManager.stopBGM();
      // If unmuting, we'd theoretically restart BGM, but simple toggle is enough for now
  }
};
