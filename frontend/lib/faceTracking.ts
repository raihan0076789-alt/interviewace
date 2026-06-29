// Eye contact and posture scoring using face landmarks.
// Runs entirely client-side — no video leaves the browser.
// Loaded via CDN script in layout.tsx (window.faceapi global).

interface CVScores {
  eyeContactScore: number; // 0.0 – 1.0
  postureScore: number;    // 0.0 – 1.0
}

interface TrackerState {
  intervalId: ReturnType<typeof setInterval> | null;
  totalFrames: number;
  faceDetectedFrames: number;
  goodGazeFrames: number;   // nose centered between eyes → looking at camera
  goodPostureFrames: number; // eyes at same height → head not tilted
  modelsLoaded: boolean;
}

const state: TrackerState = {
  intervalId: null,
  totalFrames: 0,
  faceDetectedFrames: 0,
  goodGazeFrames: 0,
  goodPostureFrames: 0,
  modelsLoaded: false,
};

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFaceApi(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).faceapi;
}

export async function loadModels(): Promise<boolean> {
  if (state.modelsLoaded) return true;
  const faceapi = getFaceApi();
  if (!faceapi) return false;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    state.modelsLoaded = true;
    return true;
  } catch {
    return false;
  }
}

export async function startTracking(videoEl: HTMLVideoElement): Promise<boolean> {
  const loaded = await loadModels();
  if (!loaded) return false;

  // Reset all counters
  state.totalFrames = 0;
  state.faceDetectedFrames = 0;
  state.goodGazeFrames = 0;
  state.goodPostureFrames = 0;

  const faceapi = getFaceApi();

  state.intervalId = setInterval(async () => {
    try {
      state.totalFrames++;

      const detection = await faceapi
        .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true);

      if (!detection) return;
      state.faceDetectedFrames++;

      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();   // 6 points
      const rightEye = landmarks.getRightEye(); // 6 points
      const nose = landmarks.getNose();         // 9 points

      // ── Eye contact: nose should be centred between both eyes ────────────
      // When looking at camera, nose tip X ≈ midpoint of left/right eye centres.
      // When looking away, the nose shifts noticeably left or right.
      const leftEyeCX = leftEye.reduce((s: number, p: {x:number}) => s + p.x, 0) / leftEye.length;
      const rightEyeCX = rightEye.reduce((s: number, p: {x:number}) => s + p.x, 0) / rightEye.length;
      const eyeMidX = (leftEyeCX + rightEyeCX) / 2;
      const eyeSpan = Math.abs(rightEyeCX - leftEyeCX);
      const noseTipX = nose[6].x; // bottom of nose
      const gazeOffset = Math.abs(noseTipX - eyeMidX) / (eyeSpan || 1);

      // Good gaze: nose within 15% of eye midpoint (strict — forces real centering)
      if (gazeOffset < 0.15) {
        state.goodGazeFrames++;
      }

      // ── Posture: eye Y positions should be level ─────────────────────────
      // A tilted head raises one eye relative to the other.
      const leftEyeCY = leftEye.reduce((s: number, p: {y:number}) => s + p.y, 0) / leftEye.length;
      const rightEyeCY = rightEye.reduce((s: number, p: {y:number}) => s + p.y, 0) / rightEye.length;
      const eyeHeightDiff = Math.abs(leftEyeCY - rightEyeCY);
      const tiltRatio = eyeHeightDiff / (eyeSpan || 1);

      // Good posture: eye height difference < 12% of inter-eye distance
      if (tiltRatio < 0.12) {
        state.goodPostureFrames++;
      }
    } catch {
      // Per-frame errors don't affect the final score
    }
  }, 500);

  return true;
}

export function stopTracking(): CVScores {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  const detected = state.faceDetectedFrames;
  if (detected === 0) {
    return { eyeContactScore: 0.5, postureScore: 0.5 };
  }

  return {
    eyeContactScore: Math.round((state.goodGazeFrames / detected) * 100) / 100,
    postureScore: Math.round((state.goodPostureFrames / detected) * 100) / 100,
  };
}