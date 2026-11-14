import OrderHistoryMain from "@/lib/ui/screen-components/earnings/order-history";
import { useApptheme } from "@/lib/context/global/theme.context";
import { SafeAreaView } from "react-native";

export default function OrderHistoryScreen() {
  const { appTheme } = useApptheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.screenBackground }}>
      <OrderHistoryMain />
    </SafeAreaView>
  );
}
