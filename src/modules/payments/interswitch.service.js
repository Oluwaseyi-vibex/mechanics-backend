import axios from "axios";

const baseURL = process.env.INTERSWITCH_BASE_URL;
// "https://qa.interswitchng.com";
const tokenURL =
  process.env.INTERSWITCH_TOKEN_URL ||
  "https://passport-v2.k8.isw.la/passport/oauth/token";

let cachedToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;

export const getAccessToken = async (force = false) => {
  const clientId = process.env.INTERSWITCH_CLIENT_ID;
  const clientSecret = process.env.INTERSWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing INTERSWITCH_CLIENT_ID or INTERSWITCH_CLIENT_SECRET",
    );
  }

  const now = Date.now();
  if (!force && cachedToken && now < tokenExpiresAt - 30_000) {
    return cachedToken;
  }

  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      console.log("Interswitch: generating access token", {
        tokenURL,
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
        force,
      });
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      const body = new URLSearchParams({
        grant_type: "client_credentials",
      });

      const response = await axios.post(tokenURL, body.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        params: {
          grant_type: "client_credentials",
        },
      });

      const token = response?.data?.access_token || response?.data?.token;
      console.log("Interswitch: token response", {
        hasToken: Boolean(token),
        expiresIn: response?.data?.expires_in,
      });
      const expiresIn = Number(response?.data?.expires_in || 3600);
      cachedToken = token;
      tokenExpiresAt = Date.now() + expiresIn * 1000;
      tokenPromise = null;
      return token;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
};

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;
    if (status === 401 && original && !original.__isRetryRequest) {
      original.__isRetryRequest = true;
      const token = await getAccessToken(true);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return api.request(original);
    }
    throw error;
  },
);

export const purchase = async (payload) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Failed to generate Interswitch access token");
  }
  console.log("Interswitch: purchase request", {
    baseURL,
    hasToken: Boolean(token),
    amount: payload?.amount,
    currency: payload?.currency,
    transactionRef: payload?.transactionRef,
  });
  return api.post("/api/v3/purchases", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const authorizeOtp = (payload) =>
  api.post("/api/v3/purchases/otps/auths", payload);

export const getTransactionStatus = (params) =>
  api.get("/collections/api/v1/gettransaction", { params });

export default api;
