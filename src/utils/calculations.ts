export const calculateOptionsROI = (
  strikePrice: number,
  contracts: number,
  premiumReceived: number,
  dateOpened: string,
  expirationDate: string
) => {
  const capitalAtRisk = strikePrice * contracts * 100;
  const totalPremiumCollected = premiumReceived * contracts * 100;
  const opened = new Date(dateOpened);
  const expiry = new Date(expirationDate);
  const daysToExpiration = Math.max(
    1,
    Math.ceil((expiry.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24))
  );
  const roiOnCapital = (totalPremiumCollected / capitalAtRisk) * (365 / daysToExpiration) * 100;
  const roiOnPremium = (totalPremiumCollected / capitalAtRisk) * 100;
  return { capital_at_risk: capitalAtRisk, total_premium_collected: totalPremiumCollected, roi_on_capital: roiOnCapital, roi_on_premium: roiOnPremium, days_to_expiration: daysToExpiration };
};
