// Core
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Hooks
import { ConfigurationContext } from "@/lib/context/global/configuration.context";
import { useApptheme } from "@/lib/context/global/theme.context";
import { useQuery } from "@apollo/client";
import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// GraphQL
import { RIDER_ORDER_HISTORY } from "@/lib/apollo/queries";

// Interfaces
import {
  IRiderHistoryOrder,
  IRiderOrderHistoryResponse,
} from "@/lib/utils/interfaces/wallet.interface";

// Components
import { NoRecordFound } from "@/lib/ui/useable-components";

const PAGE_SIZE = 20;

export default function OrderHistoryMain() {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const configuration = useContext(ConfigurationContext);
  const currency = configuration?.currencySymbol || "$";
  const money = (value?: number | null) =>
    `${currency}${Number(value ?? 0).toFixed(2)}`;

  // States
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<IRiderHistoryOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, error, refetch } = useQuery<IRiderOrderHistoryResponse>(
    RIDER_ORDER_HISTORY,
    {
      variables: { page, limit: PAGE_SIZE },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    },
  );
  const history = data?.riderOrderHistory;

  useEffect(() => {
    if (!history) return;
    setOrders((prev) => {
      if (history.page <= 1) return history.orders;
      const known = new Set(prev.map((order) => order._id));
      return [...prev, ...history.orders.filter((o) => !known.has(o._id))];
    });
  }, [history]);

  const hasMore = !!history && history.page < history.totalPages;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    try {
      await refetch({ page: 1, limit: PAGE_SIZE });
    } catch (err) {
      console.log("order history refresh failed", err);
    }
    setRefreshing(false);
  }, [refetch]);

  const header = (
    <View
      className="m-4 p-4 rounded-lg gap-2"
      style={{ backgroundColor: appTheme.themeBackground }}
    >
      <View className="flex-row justify-between">
        <Text style={{ color: appTheme.fontSecondColor }}>
          {t("Total Earnings")}
        </Text>
        <Text className="font-bold" style={{ color: "#16A34A" }}>
          {money(history?.totalEarnings)}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text style={{ color: appTheme.fontSecondColor }}>
          {t("Total Commission")}
        </Text>
        <Text className="font-bold" style={{ color: "#DC2626" }}>
          {money(history?.totalCommission)}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text style={{ color: appTheme.fontSecondColor }}>
          {t("Delivered orders")}
        </Text>
        <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
          {history?.total ?? 0}
        </Text>
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: appTheme.screenBackground }}
      data={orders}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => {
        const date = new Date(item.deliveredAt || item.createdAt || Date.now());
        return (
          <View
            className="mx-4 mb-3 p-4 rounded-lg gap-1"
            style={{ backgroundColor: appTheme.themeBackground }}
          >
            <View className="flex-row justify-between">
              <Text
                className="font-bold"
                style={{ color: appTheme.fontMainColor }}
              >
                #{item.orderId}
              </Text>
              <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                {date.toDateString()}
              </Text>
            </View>
            <Text style={{ color: appTheme.fontSecondColor }}>
              {item.restaurantName ?? "-"}
              {item.paymentMethod
                ? ` • ${item.paymentMethod === "COD" ? t("Cash") : item.paymentMethod}`
                : ""}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text style={{ color: appTheme.fontSecondColor }}>
                {t("Earning")}
              </Text>
              <Text style={{ color: "#16A34A" }}>+{money(item.earning)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ color: appTheme.fontSecondColor }}>
                {t("Commission")}
              </Text>
              <Text style={{ color: "#DC2626" }}>-{money(item.commission)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text
                className="font-bold"
                style={{ color: appTheme.fontMainColor }}
              >
                {t("Net")}
              </Text>
              <Text
                className="font-bold"
                style={{ color: appTheme.fontMainColor }}
              >
                {money(item.net)}
              </Text>
            </View>
            {!!item.changeAmount && item.changeAmount > 0 && (
              <View className="flex-row justify-between">
                <Text style={{ color: appTheme.fontSecondColor }}>
                  {t("Change")}
                </Text>
                <Text style={{ color: appTheme.fontSecondColor }}>
                  {money(item.changeAmount)}
                </Text>
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator
            className="my-12"
            color={appTheme.primary}
          />
        ) : error ? (
          <TouchableOpacity className="items-center p-6" onPress={onRefresh}>
            <Text style={{ color: appTheme.fontSecondColor }}>
              {error.message}
            </Text>
            <Text className="font-bold mt-2" style={{ color: appTheme.primary }}>
              {t("Retry")}
            </Text>
          </TouchableOpacity>
        ) : (
          <NoRecordFound />
        )
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            className="items-center py-4 mb-24"
            disabled={loading}
            onPress={() => setPage((current) => current + 1)}
          >
            {loading ? (
              <ActivityIndicator color={appTheme.primary} />
            ) : (
              <Text className="font-bold" style={{ color: appTheme.primary }}>
                {t("Load more")}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View className="mb-24" />
        )
      }
    />
  );
}
