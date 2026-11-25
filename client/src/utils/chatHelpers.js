export function sameMessage(left, right) {
  return Boolean(
    (left?.id && right?.id && left.id === right.id) ||
    (left?.waMessageId && right?.waMessageId && left.waMessageId === right.waMessageId) ||
    (left?.clientMessageId && right?.clientMessageId && left.clientMessageId === right.clientMessageId)
  );
}

export function mergeMessage(list, incoming) {
  const existingIndex = list.findIndex((message) => sameMessage(message, incoming));
  if (existingIndex === -1) return [...list, incoming];
  const merged = [...list];
  merged[existingIndex] = { ...merged[existingIndex], ...incoming };
  return merged;
}

export function mergeMessageLists(left, right) {
  const merged = right.reduce((list, message) => mergeMessage(list, message), [...left]);
  return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function sortChatsByRecent(chats) {
  return [...chats].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

export function playInboundChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore browser autoplay restrictions before first user gesture.
  }
}
