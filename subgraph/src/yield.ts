import {
  DistributionCreated,
  DistributionCompleted,
  Claimed,
} from "../generated/YieldDistribution/YieldDistribution";

import {
  YieldDistributionCreated,
  YieldDistributionCompleted,
  YieldClaimed,
} from "../generated/schema";

export function handleDistributionCreated(
  event: DistributionCreated
): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new YieldDistributionCreated(id);

  entity.distributionId = event.params.distributionId;
  entity.tokenAddress = event.params.tokenAddress;
  entity.yieldType = event.params.yieldType;
  entity.totalAmount = event.params.totalAmount;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleDistributionCompleted(
  event: DistributionCompleted
): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new YieldDistributionCompleted(id);

  entity.distributionId = event.params.distributionId;
  entity.totalDistributed = event.params.totalDistributed;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}

export function handleClaimed(event: Claimed): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new YieldClaimed(id);

  entity.distributionId = event.params.distributionId;
  entity.user = event.params.user;
  entity.amount = event.params.amount;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  entity.save();
}


