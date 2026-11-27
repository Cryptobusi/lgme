import setaV3Config from './seta-v3.config.js';

export const CANONICAL_SPP_ORDER = Object.freeze([
  'FLOOR',
  'COVENANT',
  'THIRD_SEAT',
  'RESIDUAL'
]);

export class SPPEngine {
  constructor(config = setaV3Config) {
    this.config = config;
    this.creoPerAttestation = config.creoPerAttestation ?? 0.02;
    this.dailyCapPerUser = config.dailyCapPerUser ?? 25;
    this.resetMode = config.resetMode ?? 'manual';
    this.network = config.network ?? 'Hedera Testnet v3';
    this.onDeviceSimulation = config.onDeviceSimulation ?? true;
    this.campusActive = config.campusActive ?? false;
    this.sppOrder = config.sppOrder ? [...config.sppOrder] : [...CANONICAL_SPP_ORDER];
    this.userAttestations = new Map();
  }

  getSPPOrder() {
    return [...this.sppOrder];
  }

  getCreoPerAttestation() {
    return this.creoPerAttestation;
  }

  getDailyCap() {
    return this.dailyCapPerUser;
  }

  getResetMode() {
    return this.resetMode;
  }

  isCampusActive() {
    return this.campusActive;
  }

  getNetwork() {
    return this.network;
  }

  isOnDeviceSimulation() {
    return this.onDeviceSimulation;
  }

  recordAttestation(userId) {
    const current = this.userAttestations.get(userId) || 0;
    if (current >= this.dailyCapPerUser) {
      return {
        success: false,
        reason: 'Daily cap reached',
        attestationCount: current,
        creoEarned: 0
      };
    }
    const updated = current + 1;
    this.userAttestations.set(userId, updated);
    return {
      success: true,
      attestationCount: updated,
      creoEarned: this.creoPerAttestation
    };
  }

  manualResetUserCap(userId) {
    if (userId !== undefined) {
      this.userAttestations.delete(userId);
    } else {
      this.userAttestations.clear();
    }
  }

  processSPPAllocations(allocations = {}) {
    const orderedAllocations = {};
    for (const seat of this.sppOrder) {
      orderedAllocations[seat] = allocations[seat] || 0;
    }
    return orderedAllocations;
  }
}

export default SPPEngine;
