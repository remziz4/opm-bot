import axios from 'axios';

const sendMessageToRecipients = async (recipientIds, content) => {
    for(const recipientId of recipientIds) {
        await sendMessage(recipientId.trim(), content);
    }
};

const sendMessage = async (chatId, content) => {
    const url = `${process.env.WHATSAPP_WEB_API_URL}/client/sendMessage/ABCD`;
    const data = {
        chatId: chatId,
        contentType: 'string',
        content: content
    };
    const headers = {
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

export { sendMessageToRecipients };