
export const lineCircleIntersect = (x1, y1, x2, y2, cx, cy, r) => {
    // Validation to prevent crash on NaN
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(cx) || isNaN(cy)) return false;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) return false;
    
    const t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    const closestX = x1 + Math.max(0, Math.min(1, t)) * dx;
    const closestY = y1 + Math.max(0, Math.min(1, t)) * dy;
    const distSq = (cx - closestX)*(cx - closestX) + (cy - closestY)*(cy - closestY);
    return distSq < r*r;
};

export const drawGlitch = (p) => {
    // Randomly offset slices of the canvas
    const slices = 5;
    for(let i=0; i<slices; i++) {
        const y = p.random(p.height);
        const h = p.random(10, 50);
        const offset = p.random(-20, 20);
        p.image(p.get(0, y, p.width, h), offset, y);
        
        // Random rectangles
        p.fill(p.random(255), p.random(100));
        p.noStroke();
        p.rect(p.random(p.width), p.random(p.height), p.random(50), p.random(10));
    }
};
