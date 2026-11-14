import { useApptheme } from "@/lib/context/global/theme.context";
import { SafeAreaView } from "react-native";
import WalletMain from "../../screen-components/wallet/view/main";

export default function WalletScreen() {
  // Hooks
  const { appTheme } = useApptheme();

  // WalletMain owns the scrolling list, pull-to-refresh and all queries.
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: appTheme.screenBackground }}
    >
      <WalletMain />
    </SafeAreaView>
  );
}
