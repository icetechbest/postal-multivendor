// Core
import { Text, View } from "react-native";

// Hooks
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useContext } from "react";
import { useTranslation } from "react-i18next";

// Icons
import { Ionicons } from "@expo/vector-icons";

// Interfaces
import { IWalletTransaction } from "@/lib/utils/interfaces/wallet.interface";

const TYPE_LABEL: Record<string, string> = {
  EARNING: "Delivery earning",
  COMMISSION: "Platform commission",
  DEBT_PAYMENT: "Debt paid in cash",
  DEBT_OFFSET: "Debt deducted from wallet",
  WALLET_ADJUST: "Wallet adjustment",
  DEBT_ADJUST: "Debt adjustment",
  CUSTOMER_CHANGE: "Customer change kept in cash",
};

export default function WalletLedgerItem({
  transaction,
  isLast,
}: {
  transaction: IWalletTransaction;
  isLast: boolean;
}) {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const configuration = useContext(ConfigurationContext);
  const currency = configuration?.currencySymbol || "$";

  // A WALLET entry going up is good (earnings); a DEBT entry going up is bad (you owe more).
  const increases = transaction.direction === 1;
  const isDebt = transaction.balance === "DEBT";
  const good = isDebt ? !increases : increases;
  const color = good ? "#16A34A" : "#DC2626";
  const sign = increases ? "+" : "-";
  const date = new Date(transaction.createdAt);

  return (
    <View
      className={`flex flex-row justify-between items-center p-4 w-full ${isLast ? "mb-24" : ""}`}
      style={{
        borderBottomWidth: 1,
        borderBottomColor: appTheme.borderLineColor,
      }}
    >
      <View className="flex flex-row gap-3 items-center flex-1 pr-2">
        <Ionicons
          size={22}
          name={good ? "arrow-down-circle" : "arrow-up-circle"}
          color={color}
        />
        <View className="flex flex-col gap-1 flex-1">
          <Text
            className="font-semibold"
            style={{ color: appTheme.fontMainColor }}
          >
            {t(TYPE_LABEL[transaction.type] ?? transaction.type)}
          </Text>
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
            {isDebt ? t("Owed to the Company") : t("Earnings Balance")}
            {transaction.orderId ? ` • #${transaction.orderId}` : ""}
          </Text>
          {!!transaction.note && (
            <Text
              style={{ color: appTheme.fontSecondColor, fontSize: 12 }}
              numberOfLines={2}
            >
              {transaction.note}
            </Text>
          )}
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 11 }}>
            {date.toDateString()} {date.toLocaleTimeString()}
          </Text>
        </View>
      </View>
      <Text className="font-bold text-base" style={{ color }}>
        {sign}
        {currency}
        {Number(transaction.amount ?? 0).toFixed(2)}
      </Text>
    </View>
  );
}
