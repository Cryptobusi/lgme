export function readGps(geolocation) {
  return new Promise((resolve) => {
    if (!geolocation?.getCurrentPosition) return resolve(null);
    geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: pos.coords.accuracy,
        t: new Date().toISOString()
      }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  });
}

export async function allowMotion(scope = globalThis) {
  const motion = scope.DeviceMotionEvent;
  if (!motion) return false;
  if (typeof motion.requestPermission === 'function') {
    try {
      const state = await motion.requestPermission();
      return state === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

export async function captureFrame(scope = globalThis) {
  const media = scope.navigator?.mediaDevices;
  if (!media?.getUserMedia) return '';
  let stream;
  try {
    stream = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d').drawImage(video, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  } finally {
    stream?.getTracks?.().forEach((track) => track.stop());
  }
}
