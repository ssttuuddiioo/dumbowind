export const BOID_TEX_SIZE = 32;
export const BOID_COUNT = BOID_TEX_SIZE * BOID_TEX_SIZE;

export const positionShader = /* glsl */ `
  uniform float uDelta;
  uniform vec2 uBounds;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 pos = texture2D(texturePosition, uv).xy;
    vec2 vel = texture2D(textureVelocity, uv).xy;

    pos += vel * uDelta * 60.0;

    pos.x = mod(pos.x + uBounds.x, uBounds.x);
    pos.y = mod(pos.y + uBounds.y, uBounds.y);

    gl_FragColor = vec4(pos, 0.0, 1.0);
  }
`;

export const velocityShader = /* glsl */ `
  uniform float uDelta;
  uniform float uTime;
  uniform vec2 uBaseWind;
  uniform float uBaseWindWeight;
  uniform float uSwirlWeight;
  uniform float uSeparation;
  uniform float uAlignment;
  uniform float uCohesion;
  uniform float uSpeedLimit;
  uniform vec2 uBounds;

  const float TEX = ${BOID_TEX_SIZE}.0;

  // divergence-free-ish spatial swirl: varies per-position so the
  // flock develops eddies instead of drifting as a rigid block
  vec2 swirl(vec2 p, float t) {
    float a = sin(p.x * 0.011 + t * 0.6) * cos(p.y * 0.009 - t * 0.45);
    float b = cos(p.x * 0.008 - t * 0.5) * sin(p.y * 0.012 + t * 0.35);
    float c = sin((p.x + p.y) * 0.006 + t * 0.25);
    return vec2(a + c * 0.4, b - c * 0.4);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 birdPos = texture2D(texturePosition, uv).xy;
    vec2 birdVel = texture2D(textureVelocity, uv).xy;

    vec2 sepForce = vec2(0.0);
    vec2 aliForce = vec2(0.0);
    vec2 cohOffset = vec2(0.0);
    float sepCount = 0.0;
    float aliCount = 0.0;
    float cohCount = 0.0;

    float sepSq = uSeparation * uSeparation;
    float aliSq = uAlignment * uAlignment;
    float cohSq = uCohesion * uCohesion;

    for (float y = 0.0; y < TEX; y += 1.0) {
      for (float x = 0.0; x < TEX; x += 1.0) {
        vec2 ref = (vec2(x, y) + 0.5) / TEX;
        vec2 otherPos = texture2D(texturePosition, ref).xy;
        vec2 d = otherPos - birdPos;
        // torus metric: shortest wrap-aware delta
        d.x -= uBounds.x * floor(d.x / uBounds.x + 0.5);
        d.y -= uBounds.y * floor(d.y / uBounds.y + 0.5);
        float distSq = dot(d, d);
        if (distSq < 0.0001) continue;

        if (distSq < sepSq) {
          float dist = sqrt(distSq);
          sepForce -= d / (dist * dist);
          sepCount += 1.0;
        }
        if (distSq < aliSq) {
          vec2 otherVel = texture2D(textureVelocity, ref).xy;
          aliForce += otherVel;
          aliCount += 1.0;
        }
        if (distSq < cohSq) {
          cohOffset += d;
          cohCount += 1.0;
        }
      }
    }

    vec2 acc = vec2(0.0);
    if (sepCount > 0.0) acc += sepForce * 60.0;
    if (aliCount > 0.0) acc += (aliForce / aliCount - birdVel) * 1.2;
    if (cohCount > 0.0) acc += (cohOffset / cohCount) * 0.015;

    acc += uBaseWind * uBaseWindWeight * 40.0;
    acc += swirl(birdPos, uTime) * uSwirlWeight;

    birdVel += acc * uDelta;

    float speed = length(birdVel);
    if (speed > uSpeedLimit) birdVel = birdVel / speed * uSpeedLimit;

    gl_FragColor = vec4(birdVel, 0.0, 1.0);
  }
`;
