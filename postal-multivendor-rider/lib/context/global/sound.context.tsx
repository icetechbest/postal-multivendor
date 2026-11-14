/* eslint-disable @typescript-eslint/no-require-imports */
import { useContext, useEffect, useRef, createContext } from "react";
import { useAudioPlayer, AudioSource } from "expo-audio";
// Interface
import {
  ISoundContext,
  ISoundContextProviderProps,
} from "@/lib/utils/interfaces";
// Context/Hooks
import { useUserContext } from "./user.context";
import { IOrder } from "@/lib/utils/interfaces/order.interface";

const SoundContext = createContext<ISoundContext>({} as ISoundContext);

export const SoundProvider = ({ children }: ISoundContextProviderProps) => {
  // Context/Hooks
  const { assignedOrders } = useUserContext();

  // Ids of orders we already beeped for, so each new order rings exactly once.
  const playedOrders = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  // Create audio player
  const player = useAudioPlayer(require("@/lib/assets/sound/beep3.mp3") as AudioSource);

  // Handlers: a single beep, no looping.
  const playSound = async () => {
    try {
      player.loop = false;
      await player.seekTo(0);
      player.play();
    } catch (err) {
      console.log("Error playing sound:", err);
    }
  };

  const stopSound = async () => {
    try {
      player.pause();
    } catch (err) {
      console.log("Error stopping sound:", err);
    }
  };

  useEffect(() => {
    if (!assignedOrders) return;
    const pending = assignedOrders.filter(
      (o: IOrder) => o.orderStatus === "ACCEPTED" && !o?.isPickedUp,
    );
    const fresh = pending.filter((o: IOrder) => !playedOrders.current.has(o._id));
    pending.forEach((o: IOrder) => playedOrders.current.add(o._id));

    // First load: orders that were already waiting don't beep again.
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    if (fresh.length > 0) playSound();
  }, [assignedOrders]);

  return (
    <SoundContext.Provider value={{ playSound, stopSound }}>
      {children}
    </SoundContext.Provider>
  );
};

export const SoundContextConsumer = SoundContext.Consumer;
export const useSoundContext = () => useContext(SoundContext);
export default SoundContext;