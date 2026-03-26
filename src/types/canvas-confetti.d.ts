declare module 'canvas-confetti' {
  type ConfettiFn = (options?: Record<string, any>) => void;
  const confetti: ConfettiFn;
  export default confetti;
}

