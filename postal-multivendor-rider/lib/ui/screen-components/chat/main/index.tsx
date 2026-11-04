// Core
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

// Gifted Chat
import { useApptheme } from "@/lib/context/global/theme.context";
import { useChatScreen } from "@/lib/hooks/useChat";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Bubble, GiftedChat } from "react-native-gifted-chat";

export default function ChatMain() {
  // Hooks
  const { appTheme, currentTheme } = useApptheme();
  const { t } = useTranslation();
  const { messages, onSend, inputMessage, setInputMessage, profile } =
    useChatScreen();

  const renderSend = () => (
    <View style={styles.sendButton}>
      <Ionicons
        name="send"
        size={24}
        color={appTheme.primary}
        onPress={() => {
          if (inputMessage?.trim()) onSend();
        }}
      />
    </View>
  );

  const renderBubble = (props: any) => (
    <Bubble
      {...props}
      textStyle={{
        right: {
          color: appTheme.fontMainColor,
          borderWidth: currentTheme === "dark" ? 1 : 0,
          borderColor: appTheme.borderLineColor,
          borderRadius: 12,
          paddingVertical: 4,
          paddingHorizontal: 15,
          alignItems: "center",
          justifyContent: "center",
        },
        left: { color: appTheme.fontMainColor },
      }}
      wrapperStyle={{
        right: {
          ...styles.bubbleRight,
          backgroundColor: appTheme.themeBackground,
        },
        left: { ...styles.bubbleLeft, backgroundColor: appTheme.primary },
      }}
      usernameStyle={{ color: appTheme.fontMainColor }}
    />
  );

  const scrollToBottomComponent = () => (
    <FontAwesome name="angle-double-down" size={22} color={appTheme.primary} />
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.chatContainer,
          { backgroundColor: appTheme.screenBackground },
        ]}
      >
        <GiftedChat
          messages={messages}
          user={{ _id: profile?._id ?? "", name: profile?.name }}
          renderBubble={renderBubble}
          renderSend={renderSend}
          scrollToBottom
          scrollToBottomComponent={scrollToBottomComponent}
          renderAvatar={null}
          renderUsernameOnMessage
          inverted={Platform.OS !== "web" || messages.length === 0}
          timeTextStyle={{
            left: { color: appTheme.fontMainColor },
            right: { color: appTheme.primary },
          }}
          placeholder={t("Chats Here")}
          text={inputMessage ?? ""}
          messagesContainerStyle={{
            backgroundColor: appTheme.screenBackground,
          }}
          onInputTextChanged={(m: string) => setInputMessage(String(m ?? ""))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chatContainer: { flex: 1, marginBottom: 0 },
  sendButton: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 10,
  },
  bubbleRight: {
    padding: 5,
    marginBottom: 5,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 0,
  },
  bubbleLeft: {
    padding: 5,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 15,
  },
});
