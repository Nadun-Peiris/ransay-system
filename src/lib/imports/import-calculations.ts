export type ImportItemCalculationInput = {
  quantityKg: number;
  kgPerBag: number;
  usdAmountPerKg?: number;
  amountPaidUsd?: number;
  exchangeRateLkrUsd?: number;
  undiyalPaidLkr?: number;
  dutyTaxLkr?: number;
  bankProcessingChargesLkr?: number;
  clearingChargesLkr?: number;
  miscellaneousLkr?: number;
  sellingPricePerKgLkr?: number;
};

export type CalculatedImportItem = Required<ImportItemCalculationInput> & {
  quantityBags: number;
  usdConvertedLkr: number;
  finalItemCostLkr: number;
  costPerKgLkr: number;
  costPerBagLkr: number;
  expectedRevenueLkr: number;
  expectedProfitLkr: number;
  expectedProfitMarginPercentage: number;
};

function finiteNumber(value: number | undefined, label: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
  return parsed;
}

export function calculateImportItem(
  input: ImportItemCalculationInput
): CalculatedImportItem {
  const quantityKg = finiteNumber(input.quantityKg, "Quantity KG");
  const kgPerBag = finiteNumber(input.kgPerBag, "KG per bag");
  const usdAmountPerKg = finiteNumber(input.usdAmountPerKg, "USD amount per KG");
  const amountPaidUsd = finiteNumber(input.amountPaidUsd, "Amount paid USD");
  const exchangeRateLkrUsd = finiteNumber(input.exchangeRateLkrUsd, "Exchange rate");
  const undiyalPaidLkr = finiteNumber(input.undiyalPaidLkr, "Undiyal amount");
  const dutyTaxLkr = finiteNumber(input.dutyTaxLkr, "Duty / tax");
  const bankProcessingChargesLkr = finiteNumber(
    input.bankProcessingChargesLkr,
    "Bank processing charges"
  );
  const clearingChargesLkr = finiteNumber(input.clearingChargesLkr, "Clearing charges");
  const miscellaneousLkr = finiteNumber(input.miscellaneousLkr, "Miscellaneous cost");
  const sellingPricePerKgLkr = finiteNumber(
    input.sellingPricePerKgLkr,
    "Selling price per KG"
  );

  if (quantityKg <= 0) throw new Error("Quantity KG must be greater than 0.");
  if (kgPerBag <= 0) throw new Error("KG per bag must be greater than 0.");

  for (const [label, value] of [
    ["USD amount per KG", usdAmountPerKg],
    ["Amount paid USD", amountPaidUsd],
    ["Exchange rate", exchangeRateLkrUsd],
    ["Undiyal amount", undiyalPaidLkr],
    ["Duty / tax", dutyTaxLkr],
    ["Bank processing charges", bankProcessingChargesLkr],
    ["Clearing charges", clearingChargesLkr],
    ["Miscellaneous cost", miscellaneousLkr],
    ["Selling price per KG", sellingPricePerKgLkr],
  ] as const) {
    if (value < 0) throw new Error(`${label} cannot be negative.`);
  }

  const quantityBags = quantityKg / kgPerBag;
  if (amountPaidUsd > 0 && exchangeRateLkrUsd <= 0) {
    throw new Error("Exchange rate must be greater than 0 when a USD amount is paid.");
  }
  const usdConvertedLkr = amountPaidUsd * exchangeRateLkrUsd;
  const finalItemCostLkr =
    usdConvertedLkr +
    undiyalPaidLkr +
    dutyTaxLkr +
    bankProcessingChargesLkr +
    clearingChargesLkr +
    miscellaneousLkr;
  const costPerKgLkr = finalItemCostLkr / quantityKg;
  const costPerBagLkr = costPerKgLkr * kgPerBag;
  const expectedRevenueLkr = quantityKg * sellingPricePerKgLkr;
  const expectedProfitLkr = expectedRevenueLkr - finalItemCostLkr;
  const expectedProfitMarginPercentage =
    expectedRevenueLkr > 0
      ? (expectedProfitLkr / expectedRevenueLkr) * 100
      : 0;

  return {
    quantityKg,
    kgPerBag,
    quantityBags,
    usdAmountPerKg,
    amountPaidUsd,
    exchangeRateLkrUsd,
    usdConvertedLkr,
    undiyalPaidLkr,
    dutyTaxLkr,
    bankProcessingChargesLkr,
    clearingChargesLkr,
    miscellaneousLkr,
    finalItemCostLkr,
    costPerKgLkr,
    costPerBagLkr,
    sellingPricePerKgLkr,
    expectedRevenueLkr,
    expectedProfitLkr,
    expectedProfitMarginPercentage,
  };
}

export function calculateImportShipmentTotals(items: CalculatedImportItem[]) {
  const totals = items.reduce(
    (sum, item) => ({
      totalKg: sum.totalKg + item.quantityKg,
      totalBags: sum.totalBags + item.quantityBags,
      totalAmountPaidUsd: sum.totalAmountPaidUsd + item.amountPaidUsd,
      totalUsdConvertedLkr: sum.totalUsdConvertedLkr + item.usdConvertedLkr,
      totalUndiyalPaidLkr: sum.totalUndiyalPaidLkr + item.undiyalPaidLkr,
      totalDutyTaxLkr: sum.totalDutyTaxLkr + item.dutyTaxLkr,
      totalBankProcessingChargesLkr:
        sum.totalBankProcessingChargesLkr + item.bankProcessingChargesLkr,
      totalClearingChargesLkr:
        sum.totalClearingChargesLkr + item.clearingChargesLkr,
      totalMiscellaneousLkr:
        sum.totalMiscellaneousLkr + item.miscellaneousLkr,
      totalShipmentCostLkr: sum.totalShipmentCostLkr + item.finalItemCostLkr,
      totalExpectedRevenueLkr:
        sum.totalExpectedRevenueLkr + item.expectedRevenueLkr,
      totalExpectedProfitLkr:
        sum.totalExpectedProfitLkr + item.expectedProfitLkr,
    }),
    {
      totalKg: 0,
      totalBags: 0,
      totalAmountPaidUsd: 0,
      totalUsdConvertedLkr: 0,
      totalUndiyalPaidLkr: 0,
      totalDutyTaxLkr: 0,
      totalBankProcessingChargesLkr: 0,
      totalClearingChargesLkr: 0,
      totalMiscellaneousLkr: 0,
      totalShipmentCostLkr: 0,
      totalExpectedRevenueLkr: 0,
      totalExpectedProfitLkr: 0,
    }
  );

  return {
    ...totals,
    expectedProfitMarginPercentage:
      totals.totalExpectedRevenueLkr > 0
        ? (totals.totalExpectedProfitLkr / totals.totalExpectedRevenueLkr) * 100
        : 0,
  };
}
