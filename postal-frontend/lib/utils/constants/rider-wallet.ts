/** Ledger entry types returned by the backend (`WalletTransaction.type`). */
export const WALLET_TX_TYPES = [
  'EARNING',
  'COMMISSION',
  'DEBT_PAYMENT',
  'DEBT_OFFSET',
  'WALLET_ADJUST',
  'DEBT_ADJUST',
  'CUSTOMER_CHANGE',
  'CASH_IN',
  'CASH_HANDOVER',
] as const;

/** Translation key for each ledger type (fallback: the raw type). */
export const WALLET_TX_LABEL_KEYS: Record<string, string> = {
  EARNING: 'rw_tx_EARNING',
  COMMISSION: 'rw_tx_COMMISSION',
  DEBT_PAYMENT: 'rw_tx_DEBT_PAYMENT',
  DEBT_OFFSET: 'rw_tx_DEBT_OFFSET',
  WALLET_ADJUST: 'rw_tx_WALLET_ADJUST',
  DEBT_ADJUST: 'rw_tx_DEBT_ADJUST',
  CUSTOMER_CHANGE: 'rw_tx_CUSTOMER_CHANGE',
  CASH_IN: 'rw_tx_CASH_IN',
  CASH_HANDOVER: 'rw_tx_CASH_HANDOVER',
  WALLET_CREDIT: 'rw_tx_WALLET_CREDIT',
  WALLET_DEBIT: 'rw_tx_WALLET_DEBIT',
  WALLET_REFUND: 'rw_tx_WALLET_REFUND',
};

export const WALLET_BALANCE_LABEL_KEYS: Record<string, string> = {
  WALLET: 'rw_balance_WALLET',
  DEBT: 'rw_balance_DEBT',
  CASH: 'rw_balance_CASH',
};

/** Payment methods shown in the rider order history. */
export const PAYMENT_METHOD_LABEL_KEYS: Record<string, string> = {
  COD: 'rw_pay_COD',
  CASH: 'rw_pay_COD',
  CARD: 'rw_pay_CARD',
  STRIPE: 'rw_pay_CARD',
  PAYPAL: 'rw_pay_CARD',
};
