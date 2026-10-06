declare module 'canvas-confetti' {
  type ConfettiFn = (options?: Record<string, unknown>) => void;
  const confetti: ConfettiFn;
  export default confetti;
}

