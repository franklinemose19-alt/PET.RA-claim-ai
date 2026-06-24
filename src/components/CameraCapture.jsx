// src/components/CameraCapture.jsx
//
// PET.RA Claims AI — Live Camera Capture with Guided Angles
//
// Live camera preview via getUserMedia, cycling through suggested angles
// with on-screen prompts, plus cheap pixel-math quality checks (blur via
// Laplacian-variance approximation, lighting via average brightness) run
// on each captured frame before accepting it. No ML model — this is
// intentionally lightweight, real-time, and free to run. True AI judgment
// on evidence quality/consistency still happens server-side in
// analyze-claim.js after submission; this component only catches the
// obvious "this photo is unusable" cases before they ever reach the claim.

import { useState, useRef, useEffect, useCallback } from 'react';

const ANGLE_PROMPTS = [
  { key: 'front', label: 'Capture the front' },
  { key: 'rear', label: 'Capture the rear' },
  { key: 'left', label: 'Capture the left side' },
  { key: 'right', label: 'Capture the right side' },
  { key: 'damage_closeup', label: 'Close-up of the damage' },
];

const BLUR_THRESHOLD = 18; // lower = blurrier; tuned conservatively to avoid false rejects
const DARK_THRESHOLD = 40; // average brightness 0-255; below this = "too dark"
const BRIGHT_THRESHOLD = 235; // above this = likely overexposed/glare

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [angleIndex, setAngleIndex] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [reviewFrame, setReviewFrame] = useState(null); // { dataUrl, blob, quality }
  const [capturedAngles, setCapturedAngles] = useState([]);

  const currentAngle = ANGLE_PROMPTS[angleIndex];

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        setCameraError(
          'Could not access your camera. Check that you have granted camera permission, or use "Upload from device" instead.'
        );
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Cheap, no-ML quality check: samples pixel data from the canvas to
  // estimate brightness (mean luminance) and sharpness (a lightweight
  // edge-contrast proxy for blur, not a true Laplacian convolution, but
  // close enough to flag genuinely unusable photos without real CV cost).
  const assessQuality = useCallback((ctx, width, height) => {
    const { data } = ctx.getImageData(0, 0, width, height);
    let sum = 0;
    let edgeSum = 0;
    const sampleStep = 4; // sample every 4th pixel for speed
    let sampleCount = 0;

    for (let y = 1; y < height - 1; y += sampleStep) {
      for (let x = 1; x < width - 1; x += sampleStep) {
        const i = (y * width + x) * 4;
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sum += gray;

        // Compare to the pixel one step right and one step down as a
        // cheap edge/contrast proxy — real edges (in-focus detail) produce
        // larger differences; blur smooths these out.
        const iRight = (y * width + (x + 1)) * 4;
        const iDown = ((y + 1) * width + x) * 4;
        const grayRight = (data[iRight] + data[iRight + 1] + data[iRight + 2]) / 3;
        const grayDown = (data[iDown] + data[iDown + 1] + data[iDown + 2]) / 3;
        edgeSum += Math.abs(gray - grayRight) + Math.abs(gray - grayDown);

        sampleCount++;
      }
    }

    const avgBrightness = sum / sampleCount;
    const avgEdgeStrength = edgeSum / sampleCount;

    let issue = null;
    if (avgBrightness < DARK_THRESHOLD) issue = 'Too dark — find better lighting and try again.';
    else if (avgBrightness > BRIGHT_THRESHOLD) issue = 'Too bright — reduce glare and try again.';
    else if (avgEdgeStrength < BLUR_THRESHOLD) issue = 'Looks blurry — hold steady and try again.';

    return { avgBrightness, avgEdgeStrength, issue };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const quality = assessQuality(ctx, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    canvas.toBlob(
      (blob) => {
        setReviewFrame({ dataUrl, blob, quality });
      },
      'image/jpeg',
      0.9
    );
  }

  function acceptFrame() {
    if (!reviewFrame) return;
    const file = new File([reviewFrame.blob], `${currentAngle.key}-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    onCapture({ file, angleLabel: currentAngle.key });
    setCapturedAngles((prev) => [...prev, currentAngle.key]);
    setReviewFrame(null);

    if (angleIndex < ANGLE_PROMPTS.length - 1) {
      setAngleIndex((i) => i + 1);
    }
  }

  function retakeFrame() {
    setReviewFrame(null);
  }

  function skipAngle() {
    setReviewFrame(null);
    if (angleIndex < ANGLE_PROMPTS.length - 1) {
      setAngleIndex((i) => i + 1);
    }
  }

  const allAnglesCaptured = capturedAngles.length >= ANGLE_PROMPTS.length;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <span className="text-sm font-mono">
          {capturedAngles.length} / {ANGLE_PROMPTS.length} captured
        </span>
        <button onClick={onClose} className="text-white text-sm px-3 py-1.5 rounded-lg border border-white/20">
          Done
        </button>
      </div>

      {cameraError ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-slate-300 text-sm">{cameraError}</p>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {!reviewFrame && (
              <div className="absolute inset-x-0 top-4 flex justify-center">
                <span className="px-4 py-2 rounded-full bg-black/70 text-white text-sm font-medium">
                  {currentAngle.label}
                </span>
              </div>
            )}

            {reviewFrame && (
              <div className="absolute inset-0 bg-black flex flex-col">
                <img src={reviewFrame.dataUrl} alt="Captured frame" className="flex-1 object-contain" />
                <div className="p-4 bg-black/90 space-y-3">
                  {reviewFrame.quality.issue ? (
                    <p className="text-amber-400 text-sm text-center">{reviewFrame.quality.issue}</p>
                  ) : (
                    <p className="text-emerald-400 text-sm text-center">Looks good</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={retakeFrame}
                      className="flex-1 py-3 rounded-xl border border-white/20 text-white text-sm font-medium"
                    >
                      Retake
                    </button>
                    <button
                      onClick={acceptFrame}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium"
                    >
                      Use this photo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!reviewFrame && (
            <div className="p-4 bg-black/80 flex items-center justify-center gap-4">
              <button
                onClick={skipAngle}
                disabled={angleIndex >= ANGLE_PROMPTS.length - 1}
                className="text-slate-400 text-xs px-3 py-2 disabled:opacity-30"
              >
                Skip this angle
              </button>
              <button
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 active:scale-95 transition"
                aria-label="Capture photo"
              />
              <button
                onClick={onClose}
                disabled={!allAnglesCaptured}
                className="text-emerald-400 text-xs px-3 py-2 disabled:opacity-30"
              >
                Finish
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
