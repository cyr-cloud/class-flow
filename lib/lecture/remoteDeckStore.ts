import type { DeckStore } from "./deckStore";
import { liveClient, responderId, sendLive } from "../live/client";

export const remoteDeckStore: DeckStore = {
  subscribe: (id, listener) => liveClient(id).subscribe(listener),
  snapshot: id => liveClient(id).snapshot(),
  responderId,
  setDeck: (id, deck) => sendLive(id, { action: "deck", deck }),
  clearDeck: id => sendLive(id, { action: "deck", deck: null }),
  linkBoard: (id, slideNo, boardId) => sendLive(id, { action: "board", slideNo, boardId }),
  setClassId: (id, classId) => sendLive(id, { action: "class", classId }),
  respond: (id, itemId, choiceIndex) => liveClient(id).send({ action: "respond", itemId, choiceIndex, responderId: responderId() }),
  resetItem: (id, itemId) => sendLive(id, { action: "reset", itemId }),
};
