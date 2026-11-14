// Mirrors the backend rule (services/coins.ts): whole coins = floor(order subtotal * rate).
export const isCoinsEnabled = (configuration) => configuration?.coinsEnabled !== false && Number(configuration?.coinsPerCurrencyUnit ?? 0.1) > 0

export const calculateCoins = (orderAmount, configuration) => {
  if (!isCoinsEnabled(configuration)) return 0
  const amount = Number(orderAmount)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const rate = Number(configuration?.coinsPerCurrencyUnit ?? 0.1)
  return Math.floor(amount * rate + 1e-9)
}

export const coinsToMoney = (coins, configuration) => (Number(coins) || 0) * Number(configuration?.coinValue ?? 0.5)
