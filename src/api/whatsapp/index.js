import { whatsappClient } from "../../index.js";

export const sendMessageToRecipients = async (recipientIds, content) => {
    for(const recipientId of recipientIds) {
        await whatsappClient.sendMessage(recipientId.trim(), content);
    }
};
