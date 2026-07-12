// Small reusable camera-QR-scanning helper. Framework-agnostic (no React).
import jsQR from 'jsqr';

/**
 * Starts the device camera, streams it into `videoEl`, and scans incoming frames
 * for a QR code using jsQR. Calls `onDecode(text)` exactly once, on the first
 * successful decode (it does not keep scanning afterwards — call startQrScan()
 * again if you need to scan another code). Calls `onError(err)` if camera access
 * fails (permission denied, no camera, etc).
 *
 * @param {HTMLVideoElement} videoEl - video element to preview the camera feed into
 * @param {(text: string) => void} onDecode
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} stop - stops all camera tracks and the scan loop. Safe to call multiple times.
 */
export function startQrScan(videoEl, onDecode, onError) {
  let stopped = false;
  let stream = null;
  let rafId = null;
  let canvas = null;
  let ctx = null;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        try { track.stop(); } catch (e) { /* ignore */ }
      }
      stream = null;
    }
    if (videoEl) {
      try { videoEl.pause(); } catch (e) { /* ignore */ }
      try { videoEl.srcObject = null; } catch (e) { /* ignore */ }
    }
  }

  function tick() {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth > 0) {
      if (!canvas) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', { willReadFrequently: true });
      }
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code && code.data) {
        const text = code.data;
        stop();
        onDecode(text);
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' } })
    .then((s) => {
      if (stopped) {
        for (const track of s.getTracks()) { try { track.stop(); } catch (e) { /* ignore */ } }
        return;
      }
      stream = s;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true');
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      rafId = requestAnimationFrame(tick);
    })
    .catch((err) => {
      stopped = true;
      if (onError) onError(err);
    });

  return stop;
}
