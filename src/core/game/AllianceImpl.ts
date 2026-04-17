export class AllianceRequestImpl {
  readonly id: string;
  readonly requestorID: number;
  readonly recipientID: number;
  readonly duration: number;
  readonly createdTick: number;
  readonly expiryTick: number;
  counterProposedDuration: number | null = null;

  constructor(
    id: string,
    requestorID: number,
    recipientID: number,
    duration: number,
    createdTick: number,
    requestExpiryTicks: number,
  ) {
    this.id = id;
    this.requestorID = requestorID;
    this.recipientID = recipientID;
    this.duration = duration;
    this.createdTick = createdTick;
    this.expiryTick = createdTick + requestExpiryTicks;
  }

  isExpired(currentTick: number): boolean {
    return currentTick >= this.expiryTick;
  }

  setCounterProposal(duration: number): void {
    this.counterProposedDuration = duration;
  }

  getAgreedDuration(): number {
    return this.counterProposedDuration ?? this.duration;
  }
}

export class AllianceImpl {
  readonly id: string;
  readonly player1ID: number;
  readonly player2ID: number;
  readonly formedTick: number;
  readonly duration: number;
  readonly expirationTick: number;
  extensionRequested = false;
  extensionRequestedBy: number | null = null;
  proposedExtensionDuration = 0;

  constructor(
    id: string,
    player1ID: number,
    player2ID: number,
    formedTick: number,
    duration: number,
  ) {
    this.id = id;
    this.player1ID = player1ID;
    this.player2ID = player2ID;
    this.formedTick = formedTick;
    this.duration = duration;
    this.expirationTick = formedTick + duration;
  }

  isExpired(currentTick: number): boolean {
    return currentTick >= this.expirationTick;
  }

  involves(playerID: number): boolean {
    return playerID === this.player1ID || playerID === this.player2ID;
  }

  getOtherPlayer(playerID: number): number {
    if (playerID === this.player1ID) return this.player2ID;
    if (playerID === this.player2ID) return this.player1ID;
    throw new Error(`Player ${playerID} is not part of alliance ${this.id}`);
  }

  requestExtension(requestorID: number, additionalDuration: number): void {
    this.extensionRequested = true;
    this.extensionRequestedBy = requestorID;
    this.proposedExtensionDuration = additionalDuration;
  }

  ticksRemaining(currentTick: number): number {
    return Math.max(0, this.expirationTick - currentTick);
  }

  progress(currentTick: number): number {
    return Math.min(1, (currentTick - this.formedTick) / this.duration);
  }
}
