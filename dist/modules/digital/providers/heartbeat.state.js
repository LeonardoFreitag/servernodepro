"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearManualClose = clearManualClose;
exports.getEntry = getEntry;
exports.getTrackedOpenEntries = getTrackedOpenEntries;
exports.markClosedByWatchdog = markClosedByWatchdog;
exports.resetState = resetState;
exports.touchHeartbeat = touchHeartbeat;
const heartbeats = new Map();
function getEntry(id) {
  return heartbeats.get(id);
}
function touchHeartbeat(id, now = Date.now()) {
  const isFirstSinceBoot = !heartbeats.has(id);
  heartbeats.set(id, {
    lastHeartbeatAt: now,
    openedByHeartbeat: true
  });
  return {
    isFirstSinceBoot
  };
}
function clearManualClose(id) {
  heartbeats.delete(id);
}
function markClosedByWatchdog(id) {
  const entry = heartbeats.get(id);
  if (entry) entry.openedByHeartbeat = false;
}
function getTrackedOpenEntries() {
  return Array.from(heartbeats.entries()).filter(([, entry]) => entry.openedByHeartbeat);
}
function resetState() {
  heartbeats.clear();
}