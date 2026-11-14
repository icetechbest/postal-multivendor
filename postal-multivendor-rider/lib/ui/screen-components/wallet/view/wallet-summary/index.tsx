// Core
import { Text, View } from "react-native";

// Components
import { CustomContinueButton } from "@/lib/ui/useable-components";

// Hooks
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useContext } from "react";
import { useTranslation } from "react-i18next";

// Interfaces
import { IRiderWalletSummary } from "@/lib/utils/interfaces/wallet.interface";

export default function WalletSummary({
  wallet,
  onWithdraw,
}: {
  wallet?: IRiderWalletSummary;
  onWithdraw: () => void;
}) {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const configuration = useContext(ConfigurationContext);
  const currency = configuration?.currencySymbol || "$";
  const money = (value?: number) => `${currency}${Number(value ?? 0).toFixed(2)}`;
  const net = wallet?.netBalance ?? 0;

  return (
    <View className="m-4 gap-3">
      {/* Blocked: the company stops sending orders until the rider settles */}
      {wallet?.blocked && (
        <View className="p-3 rounded-lg" style={{ backgroundColor: "#FEE2E2" }}>
          <Text className="font-semibold" style={{ color: "#B91C1C" }}>
            {t("You cannot receive new orders")}
          </Text>
          {!!wallet?.blockedReason && (
            <Text style={{ color: "#B91C1C", fontSize: 12 }}>
              {wallet.blockedReason}
            </Text>
          )}
        </View>
      )}

      {/* 1. Earnings */}
      <View
        className="flex items-center gap-2 p-4 rounded-lg"
        style={{ backgroundColor: appTheme.themeBackground }}
      >
        <Text
          className="text-[16px] font-[600]"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {t("Earnings Balance")}
        </Text>
        <Text
          className="font-semibold text-[32px]"
          style={{ color: "#16A34A" }}
        >
          {money(wallet?.currentBalance)}
        </Text>
        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
          {t("Total Earned")}: {money(wallet?.totalEarnings)}
        </Text>
        <CustomContinueButton title={t("Withdraw Now")} onPress={onWithdraw} />
      </View>

      {/* 2. Debt owed to the company */}
      <View
        className="flex items-center gap-1 p-4 rounded-lg"
        style={{ backgroundColor: appTheme.themeBackground }}
      >
        <Text
          className="text-[16px] font-[600]"
          style={{ color: appTheme.secondaryTextColor }}
        >
          {t("Owed to the Company")}
        </Text>
        <Text
          className="font-semibold text-[28px]"
          style={{ color: (wallet?.debt ?? 0) > 0 ? "#DC2626" : appTheme.fontMainColor }}
        >
          {money(wallet?.debt)}
        </Text>
        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
          {t("Company commission")} {wallet?.commissionRate ?? 20}%{" "}
          {t("on every order")}
        </Text>
      </View>

      {/* Cash collected from customers that must be handed to the company */}
      <View
        className="flex flex-row justify-between items-center px-4 py-3 rounded-lg"
        style={{ backgroundColor: appTheme.themeBackground }}
      >
        <Text
          className="font-semibold"
          style={{ color: appTheme.fontMainColor }}
        >
          {t("Cash in Hand")}
        </Text>
        <Text className="font-bold text-lg" style={{ color: appTheme.fontMainColor }}>
          {money(wallet?.cashInHand)}
        </Text>
      </View>

      {/* 3. Net */}
      <View
        className="flex flex-row justify-between items-center px-4 py-3 rounded-lg"
        style={{ backgroundColor: appTheme.themeBackground }}
      >
        <Text
          className="font-semibold"
          style={{ color: appTheme.fontMainColor }}
        >
          {t("Net Balance")}
        </Text>
        <Text
          className="font-bold text-lg"
          style={{ color: net >= 0 ? "#16A34A" : "#DC2626" }}
        >
          {net < 0 ? "-" : ""}
          {money(Math.abs(net))}
        </Text>
      </View>
    </View>
  );
}
