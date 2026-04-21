import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ProtocolMap } from "@/types";

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
