import { KYCStatusUpdated } from "../generated/KYCRegistry/KYCRegistry";
import { KYCStatusEvent } from "../generated/schema";

export function handleKYCStatusUpdated(event: KYCStatusUpdated): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();

  const entity = new KYCStatusEvent(id);
  entity.user = event.params.user;
  // enum Status 映射为 i32
  entity.oldStatus = event.params.oldStatus;
  entity.newStatus = event.params.newStatus;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}


