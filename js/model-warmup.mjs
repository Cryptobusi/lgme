export async function measureModelWarmup(scope = globalThis) {
  const now = () => (typeof scope.performance?.now === 'function' ? scope.performance.now() : Date.now());
  const start = now();
  let wasm = false;
  try {
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    wasm = typeof scope.WebAssembly?.validate === 'function' && scope.WebAssembly.validate(bytes);
  } catch {
    wasm = false;
  }
  let adapter = false;
  if (typeof scope.navigator?.gpu?.requestAdapter === 'function') {
    try { adapter = Boolean(await scope.navigator.gpu.requestAdapter()); } catch { adapter = false; }
  }
  const ms = Math.round(now() - start);
  return { pass: wasm && adapter && ms < 2500, ms, wasm, adapter };
}
