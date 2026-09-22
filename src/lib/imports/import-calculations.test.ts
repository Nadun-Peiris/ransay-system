import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateImportItem,
  calculateImportShipmentTotals,
} from "./import-calculations";

const exampleInput = {
  quantityKg: 5000,
  kgPerBag: 25,
  usdAmountPerKg: 0.8,
  amountPaidUsd: 5000,
  exchangeRateLkrUsd: 305,
  undiyalPaidLkr: 50_000,
  dutyTaxLkr: 100_000,
  bankProcessingChargesLkr: 15_000,
  clearingChargesLkr: 80_000,
  miscellaneousLkr: 20_000,
  sellingPricePerKgLkr: 400,
};

test("uses the manually entered USD payment to calculate landed cost", () => {
  const item = calculateImportItem(exampleInput);

  assert.equal(item.quantityBags, 200);
  assert.equal(item.amountPaidUsd, 5000);
  assert.equal(item.usdConvertedLkr, 1_525_000);
  assert.equal(item.finalItemCostLkr, 1_790_000);
  assert.equal(item.costPerKgLkr, 358);
  assert.equal(item.costPerBagLkr, 8_950);

  const totals = calculateImportShipmentTotals([item]);
  assert.equal(totals.totalBankProcessingChargesLkr, 15_000);
  assert.equal(totals.totalShipmentCostLkr, 1_790_000);
});

test("changing the reference USD price does not change any landed cost", () => {
  const original = calculateImportItem(exampleInput);
  const changedReferencePrice = calculateImportItem({
    ...exampleInput,
    usdAmountPerKg: 1.2,
  });

  assert.equal(changedReferencePrice.amountPaidUsd, original.amountPaidUsd);
  assert.equal(changedReferencePrice.usdConvertedLkr, original.usdConvertedLkr);
  assert.equal(changedReferencePrice.finalItemCostLkr, original.finalItemCostLkr);
  assert.equal(changedReferencePrice.costPerKgLkr, original.costPerKgLkr);
  assert.equal(changedReferencePrice.costPerBagLkr, original.costPerBagLkr);
});

test("requires a positive exchange rate when a USD payment was made", () => {
  assert.throws(
    () => calculateImportItem({ ...exampleInput, exchangeRateLkrUsd: 0 }),
    /Exchange rate must be greater than 0/
  );
});
