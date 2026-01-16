import axios from "axios";

const SESSION = 'default';

let wahaClient;

const getClient = async () => {
    if (wahaClient) return wahaClient;
    wahaClient = axios.create({
        baseURL: process.env.WAHA_BASE_URL,
        headers: {
            "X-API-KEY": process.env.WAHA_API_KEY,
            "Content-Type": "application/json"
        }
    });

    return wahaClient;
}

const getPnFromLid = async (lid) => {
    if (!lid) throw new Error("lid is required");

    const client = await getClient();
    const url = `/api/${SESSION}/lids/${encodeURIComponent(lid)}`;

    try {
        const { data } = await client.get(url);
        if (!data || typeof data.pn !== "string") {
            throw new Error("Invalid response from WAHA API: missing `pn`");
        }
        return data.pn;
    } catch (err) {
        // propagate a clear error
        throw new Error(`Failed to fetch pn for lid ${lid}: ${err.message || err}`);
    }
};

const sendMessage = async ({ chatId, text, mentions, replyInfo }) => {
    const url = '/api/sendText';

    try {
        let postBody = {
            chatId,
            text,
            session: SESSION
        };

        if (replyInfo) {
            postBody['reply_to'] = `false_${replyInfo.senderId}_${replyInfo.messageId}`;
        }

        if (mentions) {
            postBody.mentions = mentions;
        }

        await (await getClient()).post(url, postBody);
    } catch (err) {
        throw new Error(`Failed to send message to ${chatId}: ${err.message || err}`);
    }
};


export default {
    getPnFromLid,
    sendMessage
}
