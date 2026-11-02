import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it.
 * Without it a single crashing component unmounts the whole app and the rider
 * only sees an empty (gray / white) screen with no explanation.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log("AppErrorBoundary caught:", error, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          حصل خطأ غير متوقع
        </Text>
        <Text
          style={{
            color: "#B0B0B0",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Something went wrong
        </Text>
        <ScrollView
          style={{ maxHeight: 160, marginBottom: 20 }}
          contentContainerStyle={{ padding: 10 }}
        >
          <Text selectable style={{ color: "#FF8A50", fontSize: 12 }}>
            {String(error?.message ?? error)}
          </Text>
        </ScrollView>
        <TouchableOpacity
          onPress={this.reset}
          style={{
            alignSelf: "center",
            backgroundColor: "#A5C616",
            borderRadius: 24,
            paddingHorizontal: 32,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#000", fontWeight: "700" }}>Retry / إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
