const crypto = require("crypto");

const WAITLIST_SET_KEY = "rilog:waitlist:emails";
const WAITLIST_SORTED_KEY = "rilog:waitlist:created";
const WAITLIST_ENTRY_PREFIX = "rilog:waitlist:entry:";
const MAX_ADMIN_ROWS = 500;

const sendJson = (response, statusCode, payload) => {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(payload));
};

const getKvConfig = () => {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return null;
    }

    return { url: url.replace(/\/$/, ""), token };
};

const redisPipeline = async (commands) => {
    const kv = getKvConfig();

    if (!kv) {
        const error = new Error("KV environment variables are missing.");
        error.statusCode = 503;
        throw error;
    }

    const response = await fetch(`${kv.url}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${kv.token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(commands)
    });

    if (!response.ok) {
        const error = new Error(`KV request failed with ${response.status}.`);
        error.statusCode = 502;
        throw error;
    }

    const payload = await response.json();

    if (!Array.isArray(payload)) {
        const error = new Error("Unexpected KV response.");
        error.statusCode = 502;
        throw error;
    }

    return payload.map((item) => {
        if (item.error) {
            const error = new Error(item.error);
            error.statusCode = 502;
            throw error;
        }

        return item.result;
    });
};

const parseBody = async (request) => {
    if (request.body && typeof request.body === "object") {
        return request.body;
    }

    if (typeof request.body === "string") {
        return JSON.parse(request.body);
    }

    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    return rawBody ? JSON.parse(rawBody) : {};
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashValue = (value) => crypto.createHash("sha256").update(value).digest("hex");

const safeEquals = (expected, actual) => {
    if (!expected || !actual) {
        return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const parseHashResult = (result) => {
    if (!Array.isArray(result)) {
        return result || {};
    }

    return result.reduce((entry, value, index) => {
        if (index % 2 === 0) {
            entry[value] = result[index + 1];
        }

        return entry;
    }, {});
};

const handleSubscribe = async (request, response) => {
    const body = await parseBody(request);
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
        sendJson(response, 400, { message: "올바른 이메일을 입력해주세요." });
        return;
    }

    const now = new Date();
    const timestamp = now.getTime();
    const [added, , , count] = await redisPipeline([
        ["SADD", WAITLIST_SET_KEY, email],
        ["HSET", `${WAITLIST_ENTRY_PREFIX}${email}`, "email", email, "createdAt", now.toISOString(), "emailHash", hashValue(email)],
        ["ZADD", WAITLIST_SORTED_KEY, timestamp, email],
        ["SCARD", WAITLIST_SET_KEY]
    ]);

    sendJson(response, 200, {
        count: Number(count || 0),
        alreadyApplied: Number(added) === 0,
        message: Number(added) === 0 ? "이미 사전 신청된 이메일이에요." : "사전 신청이 완료됐어요."
    });
};

const handleAdminList = async (request, response) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const requestPassword = request.headers["x-admin-password"];

    if (!adminPassword) {
        sendJson(response, 503, { message: "관리자 비밀번호 환경변수가 설정되지 않았어요." });
        return;
    }

    if (!safeEquals(adminPassword, requestPassword)) {
        sendJson(response, 401, { message: "관리자 비밀번호가 올바르지 않아요." });
        return;
    }

    const [count, emails] = await redisPipeline([
        ["SCARD", WAITLIST_SET_KEY],
        ["ZREVRANGE", WAITLIST_SORTED_KEY, 0, MAX_ADMIN_ROWS - 1]
    ]);

    const emailList = Array.isArray(emails) ? emails : [];
    const rows = emailList.length
        ? await redisPipeline(emailList.map((email) => ["HGETALL", `${WAITLIST_ENTRY_PREFIX}${email}`]))
        : [];

    sendJson(response, 200, {
        count: Number(count || 0),
        entries: rows.map(parseHashResult)
    });
};

module.exports = async function handler(request, response) {
    try {
        if (request.method === "POST") {
            await handleSubscribe(request, response);
            return;
        }

        if (request.method === "GET") {
            await handleAdminList(request, response);
            return;
        }

        response.setHeader("Allow", "GET, POST");
        sendJson(response, 405, { message: "지원하지 않는 요청이에요." });
    } catch (error) {
        sendJson(response, error.statusCode || 500, {
            message: error.statusCode === 503
                ? "신청 저장소가 아직 연결되지 않았어요."
                : "요청을 처리하지 못했어요."
        });
    }
};
