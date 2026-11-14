// Core
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

// Hooks
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useMutation } from "@apollo/client";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

// GraphQL
import { ADD_CHANGE_TO_CUSTOMER_WALLET } from "@/lib/apollo/mutations/wallet.mutation";

// Components
import { FlashMessageComponent } from "@/lib/ui/useable-components";
import SpinnerComponent from "@/lib/ui/useable-components/spinner";

// Interfaces
import { IOrder } from "@/lib/utils/interfaces/order.interface";

/**
 * Cash-on-delivery helper: the customer paid with a bigger note and the rider has no change.
 * The rider enters what he received; the change goes to the customer's wallet.
 * The rider keeps the cash, so the backend adds it to what he owes the company.
 */
export default function CodChange({ order }: { order: IOrder }) {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const configuration = useContext(ConfigurationContext);
  const currency = configuration?.currencySymbol || "$";

  // States
  const [received, setReceived] = useState("");
  const [done, setDone] = useState<{ change: number; debt: number } | null>(
    null,
  );
  const alreadyAdded = !!done || Number(order?.changeAmount ?? 0) > 0;

  // What the rider actually collects in cash: the full total minus whatever was paid from the customer's wallet.
  const total = Math.max(
    0,
    Math.round(
      (Number(order?.total ?? order?.orderAmount ?? 0) -
        Number(order?.walletUsed ?? 0)) *
        100,
    ) / 100,
  );
  const receivedNumber = Number(received.replace(",", "."));
  const change =
    Number.isFinite(receivedNumber) && receivedNumber > total
      ? Math.round((receivedNumber - total) * 100) / 100
      : 0;

  const [addChange, { loading }] = useMutation(ADD_CHANGE_TO_CUSTOMER_WALLET, {
    onCompleted: ({ addChangeToCustomerWallet: result }) => {
      setDone({ change: result.changeAmount, debt: result.riderDebt });
      FlashMessageComponent({
        message: `${t("Change added to the customer wallet")}: ${currency}${Number(result.changeAmount).toFixed(2)}. ${t("You now owe the company")}: ${currency}${Number(result.riderDebt).toFixed(2)}`,
      });
    },
    onError: (error) => {
      const message = error.message || t("Something went wrong");
      // Another device / an earlier attempt already added the change.
      if (/already added/i.test(message)) setDone({ change: 0, debt: 0 });
      Alert.alert(t("Warning"), message, [{ text: t("Okay") }]);
    },
    refetchQueries: ["RiderWallet"],
  });

  const onPress = () => {
    if (!(change > 0)) {
      Alert.alert(
        t("Warning"),
        t("The received amount must be greater than the order total"),
        [{ text: t("Okay") }],
      );
      return;
    }
    Alert.alert(
      t("Are you sure?"),
      `${t("Add change to customer wallet")}: ${currency}${change.toFixed(2)}\n\n${t("The cash change stays with you and is added to what you owe the company.")}`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Confirm"),
          onPress: () =>
            addChange({
              variables: { orderId: order._id, receivedAmount: receivedNumber },
            }),
        },
      ],
    );
  };

  return (
    <View
      className="rounded-lg p-3 mt-4 gap-y-2"
      style={{
        borderWidth: 1,
        borderColor: appTheme.borderLineColor,
        backgroundColor: appTheme.themeBackground,
      }}
    >
      <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
        {t("Cash on delivery change")}
      </Text>
      <View className="flex-row justify-between">
        <Text style={{ color: appTheme.fontSecondColor }}>
          {t("Order Amount")}
        </Text>
        <Text style={{ color: appTheme.fontMainColor }}>
          {currency}
          {total.toFixed(2)}
        </Text>
      </View>

      {alreadyAdded ? (
        <Text style={{ color: "#16A34A" }}>
          {done?.change
            ? `${t("Change added to the customer wallet")}: ${currency}${Number(done.change).toFixed(2)}`
            : t("Change already added")}
        </Text>
      ) : (
        <>
          <Text style={{ color: appTheme.fontSecondColor }}>
            {t("Amount received from customer")}
          </Text>
          <TextInput
            value={received}
            onChangeText={setReceived}
            keyboardType="decimal-pad"
            placeholder={t("Enter the amount the customer gave you")}
            placeholderTextColor={appTheme.fontSecondColor}
            style={{
              borderWidth: 1,
              borderColor: appTheme.borderLineColor,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: appTheme.fontMainColor,
            }}
          />
          <View className="flex-row justify-between">
            <Text style={{ color: appTheme.fontSecondColor }}>
              {t("Change to return")}
            </Text>
            <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
              {currency}
              {change.toFixed(2)}
            </Text>
          </View>
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
            {t(
              "The cash change stays with you and is added to what you owe the company.",
            )}
          </Text>
          <TouchableOpacity
            className="h-12 rounded-3xl justify-center"
            style={{
              backgroundColor: change > 0 ? appTheme.primary : appTheme.borderLineColor,
            }}
            disabled={loading || !(change > 0)}
            onPress={onPress}
          >
            {loading ? (
              <SpinnerComponent />
            ) : (
              <Text
                className="text-center text-base font-medium"
                style={{ color: appTheme.black }}
              >
                {t("Add change to customer wallet")}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
