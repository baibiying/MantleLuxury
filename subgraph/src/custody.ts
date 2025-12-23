import {
  AssetRegistered,
  StatusUpdated,
  CustodyInfoUpdated,
  InsuranceInfoUpdated,
} from "../generated/CustodyManager/CustodyManager";

import {
  AssetRegisteredEvent,
  AssetStatusUpdatedEvent,
  CustodyInfoUpdatedEvent,
  InsuranceInfoUpdatedEvent,
} from "../generated/schema";

export function handleAssetRegistered(event: AssetRegistered): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new AssetRegisteredEvent(id);

  entity.assetId = event.params.assetId;
  entity.tokenAddress = event.params.tokenAddress;
  entity.custodyHash = event.params.custodyHash;
  entity.insuranceHash = event.params.insuranceHash;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleStatusUpdated(event: StatusUpdated): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new AssetStatusUpdatedEvent(id);

  entity.assetId = event.params.assetId;
  entity.oldStatus = event.params.oldStatus;
  entity.newStatus = event.params.newStatus;
  entity.timestamp = event.params.timestamp;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;

  entity.save();
}

export function handleCustodyInfoUpdated(event: CustodyInfoUpdated): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new CustodyInfoUpdatedEvent(id);

  entity.assetId = event.params.assetId;
  entity.oldHash = event.params.oldHash;
  entity.newHash = event.params.newHash;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleInsuranceInfoUpdated(
  event: InsuranceInfoUpdated
): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new InsuranceInfoUpdatedEvent(id);

  entity.assetId = event.params.assetId;
  entity.oldHash = event.params.oldHash;
  entity.newHash = event.params.newHash;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}


