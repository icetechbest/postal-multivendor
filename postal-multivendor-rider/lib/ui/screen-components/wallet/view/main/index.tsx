// Interfaces
import { ILazyQueryResult } from "@/lib/utils/interfaces";
import {
  IRiderByIdResponse,
  IRiderCurrentWithdrawRequestResponse,
  // IRiderEarningsResponse,
  IRiderTransactionHistoryResponse,
} from "@/lib/utils/interfaces/rider.interface";

// Components
import {
  CustomContinueButton,
  FlashMessageComponent,
  NoRecordFound,
} from "@/lib/ui/useable-components";
import WithdrawModal from "../form";
import RecentTransaction from "../recent-transactions";
import WalletLedgerItem from "../wallet-ledger-item";
import WalletSummary from "../wallet-summary";

// Hooks
import { useUserContext } from "@/lib/context/global/user.context";
import { useLazyQueryQL } from "@/lib/hooks/useLazyQueryQL";
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// GraphQL
import { CREATE_WITHDRAW_REQUEST } from "@/lib/apollo/mutations/withdraw-request.mutation";
import {
  RIDER_BY_ID,
  RIDER_CURRENT_WITHDRAW_REQUEST,
  RIDER_TRANSACTIONS_HISTORY,
  RIDER_WALLET,
} from "@/lib/apollo/queries";
import {
  IRiderWalletResponse,
  IWalletTransaction,
} from "@/lib/utils/interfaces/wallet.interface";
import { GraphQLError } from "graphql";

// Expo
import { router, useFocusEffect } from "expo-router";

// Core
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Skeletons
import { useApptheme } from "@/lib/context/global/theme.context";
import { WalletScreenMainLoading } from "@/lib/ui/skeletons";

const LEDGER_PAGE_SIZE = 20;

export default function WalletMain() {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  // States
  const [isBottomModalOpen, setIsBottomModalOpen] = useState(false);
  const [amountErrMsg, setAmountErrMsg] = useState("");
  const { userId } = useUserContext();
  const [tab, setTab] = useState<"activity" | "withdrawals">("activity");
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<IWalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Wallet (earnings balance, debt to the company and the ledger)
  const {
    data: walletData,
    loading: isWalletLoading,
    error: walletError,
    refetch: refetchWallet,
  } = useQuery<IRiderWalletResponse>(RIDER_WALLET, {
    variables: { page, limit: LEDGER_PAGE_SIZE },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    skip: !userId,
  });
  const wallet = walletData?.riderWallet?.wallet;
  const ledgerMeta = walletData?.riderWallet?.transactions;

  // Accumulate pages: page 1 replaces the list, later pages are appended (deduped).
  useEffect(() => {
    if (!ledgerMeta) return;
    setLedger((prev) => {
      if (ledgerMeta.page <= 1) return ledgerMeta.transactions;
      const known = new Set(prev.map((item) => item._id));
      return [
        ...prev,
        ...ledgerMeta.transactions.filter((item) => !known.has(item._id)),
      ];
    });
  }, [ledgerMeta]);

  const hasMore = !!ledgerMeta && ledgerMeta.page < ledgerMeta.totalPages;

  const reloadWallet = useCallback(async () => {
    setPage(1);
    try {
      await refetchWallet({ page: 1, limit: LEDGER_PAGE_SIZE });
    } catch (err) {
      console.log("wallet refresh failed", err);
    }
  }, [refetchWallet]);

  // Queries

  const {
    data: riderTransactionData,
    fetch: fetchRiderTransactions,
    loading: isRiderTransactionLoading,
  } = useLazyQueryQL(
    RIDER_TRANSACTIONS_HISTORY,
    {},
    {
      userType: "RIDER",
      userId: userId,
    },
  ) as ILazyQueryResult<
    IRiderTransactionHistoryResponse | undefined,
    {
      userType: string;
      userId: string;
    }
  >;
  const {
    data: riderProfileData,
    fetch: fetchRiderProfile,
    loading: isRiderProfileLoading,
  } = useLazyQueryQL(
    RIDER_BY_ID,
    { enabled: !!userId },
    {
      id: userId,
    },
  ) as ILazyQueryResult<IRiderByIdResponse | undefined, { id: string }>;

  const {
    data: riderCurrentWithdrawRequestData,
    fetch: fetchRiderCurrentWithdrawRequest,
    loading: isRiderCurrentWithdrawRequestLoading,
  } = useLazyQueryQL(
    RIDER_CURRENT_WITHDRAW_REQUEST,
    {},
    { riderId: userId },
  ) as ILazyQueryResult<
    IRiderCurrentWithdrawRequestResponse | undefined,
    {
      riderId: string;
    }
  >;

  // Mutaions
  const [createWithDrawRequest, { loading: createWithDrawRequestLoading }] =
    useMutation(CREATE_WITHDRAW_REQUEST, {
      onCompleted: () => {
        FlashMessageComponent({
          message: t("Successfully created the withdraw request"),
        });
        setIsBottomModalOpen(false);
        // setIsModalVisible(true)
        router.push({
          pathname: "/(tabs)/wallet/(routes)/success",
        });
      },
      onError: (error) => {
        Alert.alert(t("Warning"), error.message, [
          {
            onPress: () => setIsBottomModalOpen(false),
            text: t("Okay"),
          },
        ]);
        FlashMessageComponent({
          message:
            error.message ||
            error.graphQLErrors[0].message ||
            JSON.stringify(error) ||
            t("Something went wrong"),
        });
      },
      refetchQueries: [
        {
          query: RIDER_BY_ID,
          variables: { riderId: userId },
        },
        {
          query: RIDER_TRANSACTIONS_HISTORY,
          variables: { userId: userId, userType: "RIDER" },
        },
        {
          query: RIDER_CURRENT_WITHDRAW_REQUEST,
          variables: { riderId: userId },
        },
        "RiderWallet",
      ],
    });

  // Handlers
  async function handleFormSubmission(withdrawAmount: number) {
    const currentAmount =
      wallet?.currentBalance ?? riderProfileData?.rider.currentWalletAmount ?? 0;
    if (withdrawAmount > (currentAmount || 0)) {
      return setAmountErrMsg(
        `${t("Please enter a valid amount, You have $")}${currentAmount} ${t("available")}.`,
      );
    } else if (withdrawAmount < 10) {
      return setAmountErrMsg(
        t("The withdraw amount must be atleast 10 or greater"),
      );
    } else if (typeof withdrawAmount !== "number") {
      return setAmountErrMsg(t("Please enter a valid number"));
    }
    try {
      await createWithDrawRequest({
        variables: {
          requestAmount: withdrawAmount,
        },
      });
    } catch (error) {
      const err = error as GraphQLError;

      // FlashMessageComponent({
      //   message:
      //     err.message || JSON.stringify(error) || t("Something went wrong"),
      // });

      console.log("error wallet", err);
    }
  }
  // Loading state: only block the screen on the very first load
  const isLoading =
    createWithDrawRequestLoading ||
    (isRiderProfileLoading && !riderProfileData) ||
    (isWalletLoading && !walletData) ||
    (isRiderTransactionLoading && !riderTransactionData) ||
    (isRiderCurrentWithdrawRequestLoading && !riderCurrentWithdrawRequestData);

  // UseEffects
  useEffect(() => {
    if (userId) {
      fetchRiderProfile();
      fetchRiderTransactions();
      fetchRiderCurrentWithdrawRequest({
        riderId: userId,
      });
    }
  }, [userId]);

  // Always show fresh numbers when the tab gets focus (e.g. right after delivering an order)
  useFocusEffect(
    useCallback(() => {
      if (userId) reloadWallet();
    }, [userId, reloadWallet]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      reloadWallet(),
      Promise.resolve(fetchRiderProfile()),
      Promise.resolve(fetchRiderTransactions()),
      Promise.resolve(fetchRiderCurrentWithdrawRequest({ riderId: userId })),
    ]);
    setRefreshing(false);
  };

  if (isLoading) return <WalletScreenMainLoading />;

  const withdrawals = riderTransactionData?.transactionHistory?.data ?? [];
  const pending =
    riderCurrentWithdrawRequestData?.riderCurrentWithdrawRequest;

  const header = (
    <View>
      <WalletSummary
        wallet={wallet}
        onWithdraw={() => setIsBottomModalOpen((prev) => !prev)}
      />
      {pending && pending.requestAmount !== 0 && (
        <View
          style={{
            backgroundColor: appTheme.themeBackground,
            borderBottomColor: appTheme.borderLineColor,
            borderBottomWidth: 1,
          }}
        >
          <Text
            className="font-bold text-lg p-5 mt-4"
            style={{ color: appTheme.fontMainColor }}
          >
            {t("Pending Request")}
          </Text>
          <RecentTransaction
            transaction={{
              amountTransferred: pending.requestAmount || 0,
              status: pending.status,
              createdAt: pending.createdAt,
            }}
            key={pending.createdAt}
            isLast={false}
          />
        </View>
      )}
      <View
        className="flex-row"
        style={{
          backgroundColor: appTheme.themeBackground,
          borderBottomColor: appTheme.borderLineColor,
          borderBottomWidth: 1,
        }}
      >
        {(
          [
            ["activity", "Wallet Activity"],
            ["withdrawals", "Withdrawals"],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            className="flex-1 items-center py-4"
            onPress={() => setTab(key)}
            style={{
              borderBottomWidth: 2,
              borderBottomColor: tab === key ? appTheme.primary : "transparent",
            }}
          >
            <Text
              className="font-bold"
              style={{
                color: tab === key ? appTheme.fontMainColor : appTheme.fontSecondColor,
              }}
            >
              {t(label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "activity" && walletError && !ledger.length && (
        <TouchableOpacity className="items-center p-6" onPress={reloadWallet}>
          <Text style={{ color: appTheme.fontSecondColor }}>
            {walletError.message}
          </Text>
          <Text className="font-bold mt-2" style={{ color: appTheme.primary }}>
            {t("Retry")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View
      className="w-[100%] flex-1"
      style={{ backgroundColor: appTheme.screenBackground }}
    >
      {tab === "activity" ? (
        <FlatList
          data={ledger}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item, index }) => (
            <View style={{ backgroundColor: appTheme.themeBackground }}>
              <WalletLedgerItem
                transaction={item}
                isLast={!hasMore && index === ledger.length - 1}
              />
            </View>
          )}
          ListEmptyComponent={
            isWalletLoading ? null : (
              <View style={{ backgroundColor: appTheme.themeBackground }}>
                <NoRecordFound />
              </View>
            )
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                className="items-center py-4 mb-24"
                disabled={isWalletLoading}
                onPress={() => setPage((current) => current + 1)}
                style={{ backgroundColor: appTheme.themeBackground }}
              >
                {isWalletLoading ? (
                  <ActivityIndicator color={appTheme.primary} />
                ) : (
                  <Text className="font-bold" style={{ color: appTheme.primary }}>
                    {t("Load more")}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={withdrawals}
          keyExtractor={(item, index) => `${item.createdAt}-${index}`}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item, index }) => (
            <View style={{ backgroundColor: appTheme.themeBackground }}>
              <RecentTransaction
                transaction={item}
                isLast={index === withdrawals.length - 1}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ backgroundColor: appTheme.themeBackground }}>
              <NoRecordFound />
            </View>
          }
        />
      )}

      <WithdrawModal
        isBottomModalOpen={isBottomModalOpen}
        setIsBottomModalOpen={setIsBottomModalOpen}
        amountErrMsg={amountErrMsg}
        setAmountErrMsg={setAmountErrMsg}
        currentTotal={
          wallet?.currentBalance ?? riderProfileData?.rider?.currentWalletAmount ?? 0
        }
        handleFormSubmission={handleFormSubmission}
        withdrawRequestLoading={createWithDrawRequestLoading}
      />
    </View>
  );
}
