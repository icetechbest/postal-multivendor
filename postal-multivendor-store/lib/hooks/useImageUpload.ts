import { useCallback, useState } from "react";
import { useApolloClient } from "@apollo/client";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { showMessage } from "react-native-flash-message";

import { UPLOAD_IMAGE } from "@/lib/apollo/mutations/menu.mutation";
import { errorMessage } from "@/lib/hooks/useMenu";

// The backend accepts images up to 8 MB; base64 inflates data by ~4/3.
const MAX_BASE64_LENGTH = Math.floor((8 * 1024 * 1024 * 4) / 3);

type Source = "camera" | "library";

/**
 * Lets the store pick (or take) a photo and uploads it to the backend.
 * `pickAndUpload` resolves to the public image URL, or null if cancelled/failed.
 */
export default function useImageUpload() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [uploading, setUploading] = useState(false);

  const launch = useCallback(
    async (source: Source) => {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("Permission needed"),
          t("Please allow access in your phone settings to add pictures."),
        );
        return null;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      };
      return source === "camera"
        ? ImagePicker.launchCameraAsync(options)
        : ImagePicker.launchImageLibraryAsync(options);
    },
    [t],
  );

  const pickAndUpload = useCallback(
    async (source: Source): Promise<string | null> => {
      try {
        const result = await launch(source);
        if (!result || result.canceled || !result.assets?.[0]) return null;
        const asset = result.assets[0];
        if (!asset.base64) throw new Error(t("Could not read the picture"));
        if (asset.base64.length > MAX_BASE64_LENGTH) {
          throw new Error(t("The picture is too large (max 8 MB)"));
        }
        setUploading(true);
        const { data } = await client.mutate({
          mutation: UPLOAD_IMAGE,
          variables: { image: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` },
        });
        const url: string | undefined = data?.uploadImageToS3?.imageUrl;
        if (!url) throw new Error(t("Upload failed"));
        return url;
      } catch (error) {
        showMessage({
          message: errorMessage(error, t("Upload failed")),
          type: "danger",
        });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [client, launch, t],
  );

  /** Asks camera or gallery, then uploads. */
  const chooseAndUpload = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        Alert.alert(
          t("Add a picture"),
          undefined,
          [
            { text: t("Take a photo"), onPress: () => pickAndUpload("camera").then(resolve) },
            { text: t("Choose from gallery"), onPress: () => pickAndUpload("library").then(resolve) },
            { text: t("Cancel"), style: "cancel", onPress: () => resolve(null) },
          ],
          { cancelable: true, onDismiss: () => resolve(null) },
        );
      }),
    [pickAndUpload, t],
  );

  return { uploading, chooseAndUpload };
}
