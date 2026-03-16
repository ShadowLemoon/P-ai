import { type Ref, type ShallowRef } from "vue";
import { invokeTauri } from "../../../services/tauri-api";
import type { ChatMessage } from "../../../types/app";

type RewindConversationResult = {
  removedCount: number;
  remainingCount: number;
  recalledUserMessage?: ChatMessage;
};

type UseChatRewindActionsOptions = {
  activeApiConfigId: Ref<string>;
  activeAgentId: Ref<string>;
  currentConversationId: Ref<string>;
  allMessages: ShallowRef<ChatMessage[]>;
  visibleMessageBlockCount: Ref<number>;
  chatting: Ref<boolean>;
  forcingArchive: Ref<boolean>;
  chatInput: Ref<string>;
  clipboardImages: Ref<Array<{ mime: string; bytesBase64: string; savedPath?: string }>>;
  deleteUnarchivedConversationFromArchives: (conversationId: string) => Promise<void>;
  sendChat: () => Promise<void>;
  setStatusError: (key: string, error: unknown) => void;
  removeBinaryPlaceholders: (text: string) => string;
  messageText: (message: ChatMessage) => string;
  extractMessageImages: (message: ChatMessage) => Array<{ mime: string; bytesBase64: string }>;
};

export function useChatRewindActions(options: UseChatRewindActionsOptions) {
  function resetVisibleBlocksAfterRewind(nextMessages: ChatMessage[]) {
    const assistantIndices: number[] = [];
    for (let i = 0; i < nextMessages.length; i += 1) {
      if (nextMessages[i]?.role === "assistant") assistantIndices.push(i);
    }
    if (assistantIndices.length < 2) {
      options.visibleMessageBlockCount.value = Math.max(1, nextMessages.length || 1);
      return;
    }
    const startIndex = assistantIndices[assistantIndices.length - 2];
    options.visibleMessageBlockCount.value = Math.max(1, nextMessages.length - startIndex);
  }

  async function rewindConversationFromTurn(turnId: string): Promise<ChatMessage | null> {
    const apiConfigId = String(options.activeApiConfigId.value || "").trim();
    const agentId = String(options.activeAgentId.value || "").trim();
    const conversationId = String(options.currentConversationId.value || "").trim();
    const messageId = String(turnId || "").trim();
    if (!apiConfigId || !agentId || !messageId) return null;
    const currentMessages = [...options.allMessages.value];
    try {
      const result = await invokeTauri<RewindConversationResult>("rewind_conversation_from_message", {
        input: {
          session: {
            apiConfigId,
            agentId,
            conversationId: conversationId || null,
          },
          messageId,
        },
      });
      let keepCountFromLocal = -1;
      const directIndex = currentMessages.findIndex((item) => item.id === messageId);
      if (directIndex >= 0) {
        const directRole = String(currentMessages[directIndex]?.role || "").trim();
        if (directRole === "user") {
          keepCountFromLocal = directIndex;
        } else {
          for (let i = directIndex - 1; i >= 0; i -= 1) {
            if (String(currentMessages[i]?.role || "").trim() === "user") {
              keepCountFromLocal = i;
              break;
            }
          }
        }
      }
      const keepCountFromBackend = Math.max(0, Math.min(currentMessages.length, Number(result.remainingCount) || 0));
      const keepCount = keepCountFromLocal >= 0 ? keepCountFromLocal : keepCountFromBackend;
      const nextMessages = currentMessages.slice(0, keepCount);
      options.allMessages.value = nextMessages;
      resetVisibleBlocksAfterRewind(nextMessages);
      return result.recalledUserMessage
        ?? currentMessages[keepCount]
        ?? currentMessages.find((item) => item.id === messageId && item.role === "user")
        ?? null;
    } catch (error) {
      options.setStatusError("status.rewindConversationFailed", error);
      return null;
    }
  }

  async function deleteUnarchivedConversation(conversationId: string) {
    await options.deleteUnarchivedConversationFromArchives(conversationId);
    if (String(options.currentConversationId.value || "").trim() === String(conversationId || "").trim()) {
      options.currentConversationId.value = "";
      options.allMessages.value = [];
      options.visibleMessageBlockCount.value = 1;
    }
  }

  async function handleRecallTurn(payload: { turnId: string }) {
    if (options.chatting.value || options.forcingArchive.value) return;
    const recalledUserMessage = await rewindConversationFromTurn(payload.turnId);
    if (!recalledUserMessage) return;
    options.chatInput.value = options.removeBinaryPlaceholders(options.messageText(recalledUserMessage));
    options.clipboardImages.value = options.extractMessageImages(recalledUserMessage);
  }

  async function handleRegenerateTurn(payload: { turnId: string }) {
    if (options.chatting.value || options.forcingArchive.value) return;
    const recalledUserMessage = await rewindConversationFromTurn(payload.turnId);
    if (!recalledUserMessage) return;
    options.chatInput.value = options.removeBinaryPlaceholders(options.messageText(recalledUserMessage));
    options.clipboardImages.value = options.extractMessageImages(recalledUserMessage);
    await options.sendChat();
  }

  return {
    handleRecallTurn,
    handleRegenerateTurn,
    deleteUnarchivedConversation,
  };
}
