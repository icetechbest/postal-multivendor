/* eslint-disable @typescript-eslint/no-require-imports */
import { ResizeMode, Video } from "expo-av";
import { StyleSheet } from "react-native";
import { useRef, useState } from "react";

export default function SplashVideo({
  onLoaded,
  onFinish,
}: {
  onLoaded: () => void;
  onFinish: () => void;
}) {
  const video = useRef(null);
  const [lastStatus, setStatus] = useState<any>({});

  return (
    <Video
      ref={video}
      style={StyleSheet.absoluteFill}
      source={require("@/lib/assets/video/mobile-splash.mp4")}
      shouldPlay={!(lastStatus.isLoaded && lastStatus.didJustFinish)}
      isLooping={false}
      onError={() => {
        // a broken video must never block the app
        onLoaded();
        onFinish();
      }}
      resizeMode={ResizeMode.COVER}
      onPlaybackStatusUpdate={(status: any) => {
        if (status.isLoaded) {
          if (lastStatus.isLoaded !== status.isLoaded) {
            onLoaded();
          }
          if (status.didJustFinish) {
            onFinish();
          }
        }
        setStatus(() => status);
      }}
    />
  );
}
