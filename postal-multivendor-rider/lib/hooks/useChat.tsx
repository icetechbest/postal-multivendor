import { useMutation, useQuery } from "@apollo/client";
import { useRoute } from "@react-navigation/native";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { IMessage } from "react-native-gifted-chat";

// Context
import UserContext from "../context/global/user.context";

// API
import { SEND_CHAT_MESSAGE } from "@/lib/apollo/mutations/chat.mutation";
import { CHAT } from "@/lib/apollo/queries";
import { SUBSCRIPTION_NEW_MESSAGE } from "@/lib/apollo/subscriptions";

interface IChatMessage {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface IChatQuery {
  chat: IChatMessage[];
}

export const useChatScreen = () => {
  const route = useRoute();
  const { id: orderId } = route.params as { id: string };

  const { dataProfile, userId } = useContext(UserContext);
  // The context already exposes the rider profile itself (not the { rider } wrapper).
  const riderId = String(dataProfile?._id ?? userId ?? "");
  const riderName = dataProfile?.name;

  // States
  const [inputMessage, setInputMessage] = useState("");
  // Text of the message being sent: restored into the input if sending fails.
  const pendingText = useRef("");

  // API
  const {
    subscribeToMore: subscribeToMessages,
    updateQuery: updateChatQuery,
    data: chatData,
    loading,
    error,
    refetch,
  } = useQuery<IChatQuery>(CHAT, {
    variables: { order: orderId },
    fetchPolicy: "network-only",
    skip: !orderId,
  });

  // The sender receives its own message from both the mutation and the subscription: never add it twice.
  const appendMessage = useCallback(
    (message?: IChatMessage | null) => {
      if (!message?.id) return;
      updateChatQuery((prev) => {
        const existing = prev?.chat ?? [];
        if (existing.some((item) => item.id === message.id)) return prev;
        return { ...prev, chat: [message, ...existing] };
      });
    },
    [updateChatQuery],
  );

  const [send, { loading: sending }] = useMutation(SEND_CHAT_MESSAGE, {
    onCompleted: ({
      sendChatMessage: result,
    }: {
      sendChatMessage: {
        success: boolean;
        message: string;
        data?: IChatMessage;
      };
    }) => {
      if (!result?.success) {
        setInputMessage(pendingText.current);
        Alert.alert("Error", result?.message);
        return;
      }
      appendMessage(result.data);
    },
    onError: (err) => {
      setInputMessage(pendingText.current);
      Alert.alert("Error", err.message);
    },
  });

  // Handler
  const onSend = () => {
    const text = inputMessage.trim();
    if (!text || !orderId || sending) return;
    pendingText.current = text;
    send({
      variables: {
        orderId: String(orderId),
        messageInput: {
          message: text,
          user: { id: String(riderId), name: String(riderName ?? "") },
        },
      },
    });
    setInputMessage("");
  };

  // Live updates: subscribe once per order.
  useEffect(() => {
    if (!orderId) return;
    const unsubscribe = subscribeToMessages({
      document: SUBSCRIPTION_NEW_MESSAGE,
      variables: { order: orderId },
      updateQuery: (prev, { subscriptionData }) => {
        const incoming = (
          subscriptionData?.data as
            | { subscriptionNewMessage?: IChatMessage }
            | undefined
        )?.subscriptionNewMessage;
        if (!incoming) return prev;
        const existing = (prev as IChatQuery | undefined)?.chat ?? [];
        if (existing.some((item) => item.id === incoming.id)) return prev;
        return { ...prev, chat: [incoming, ...existing] };
      },
    });
    return unsubscribe;
  }, [orderId, subscribeToMessages]);

  // Messages sent while the socket was down are missed: reload when the screen is reopened.
  const refresh = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  // GiftedChat renders newest-first while the API returns oldest-first: sort once here.
  const messages: IMessage[] = useMemo(
    () =>
      [...(chatData?.chat ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
            String(b.id).localeCompare(String(a.id)),
        )
        .map((message) => ({
          _id: message.id,
          text: message.message,
          createdAt: new Date(message.createdAt),
          user: {
            _id: String(message.user?.id ?? ""),
            name: message.user?.name,
          },
        })),
    [chatData],
  );

  return {
    messages,
    onSend,
    inputMessage,
    setInputMessage,
    loading,
    error,
    sending,
    refresh,
    profile: { _id: riderId, name: riderName },
  };
};
