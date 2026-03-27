import axios from "axios";

const billsBaseUrl =
  process.env.INTERSWITCH_BILLS_BASE_URL ||
  "https://qa.interswitchng.com/quicktellerservice/api/v5";

const terminalId = process.env.INTERSWITCH_TERMINAL_ID;
const billsTokenUrl =
  process.env.INTERSWITCH_BILLS_TOKEN_URL ||
  "https://apps.qa.interswitchng.com/passport/oauth/token";
const billsScope = process.env.INTERSWITCH_BILLS_SCOPE || "profile";
const billsClientId = process.env.INTERSWITCH_BILLS_CLIENT_ID;
const billsClientSecret = process.env.INTERSWITCH_BILLS_CLIENT_SECRET;

let cachedBillsToken = null;
let billsTokenExpiresAt = 0;
let billsTokenPromise = null;

const getBillsAccessToken = async (force = false) => {
  if (!billsClientId || !billsClientSecret) {
    throw new Error("Missing INTERSWITCH_BILLS_CLIENT_ID/SECRET");
  }

  const now = Date.now();
  if (!force && cachedBillsToken && now < billsTokenExpiresAt - 30_000) {
    return cachedBillsToken;
  }

  if (billsTokenPromise) return billsTokenPromise;

  billsTokenPromise = (async () => {
    const auth = Buffer.from(`${billsClientId}:${billsClientSecret}`).toString(
      "base64",
    );
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: billsScope,
    });

    console.log("Bills: generating access token", {
      billsTokenUrl,
      hasClientId: Boolean(billsClientId),
      hasClientSecret: Boolean(billsClientSecret),
      scope: billsScope,
      force,
    });

    const response = await axios.post(billsTokenUrl, body.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      params: {
        grant_type: "client_credentials",
        scope: billsScope,
      },
    });

    const token = response?.data?.access_token || response?.data?.token;
    console.log("Bills: token response", {
      hasToken: Boolean(token),
      expiresIn: response?.data?.expires_in,
    });
    const expiresIn = Number(response?.data?.expires_in || 3600);
    cachedBillsToken = token;
    billsTokenExpiresAt = Date.now() + expiresIn * 1000;
    billsTokenPromise = null;
    return token;
  })();

  return billsTokenPromise;
};

const buildHeaders = async () => {
  const token = await getBillsAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    Authentication: `Bearer ${token}`,
    "Content-Type": "application/json",
    TerminalID: terminalId,
  };
};

const getAmountUnit = () =>
  (process.env.INTERSWITCH_BILLS_AMOUNT_UNIT || "KOBO").toUpperCase();

const formatAmount = (amount) => {
  const unit = getAmountUnit();
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return amount;
  if (unit === "NAIRA") {
    return (numeric / 100).toFixed(2);
  }
  return String(numeric);
};

export const validateCustomer = async ({ paymentCode, customerId }) => {
  if (!terminalId) throw new Error("Missing INTERSWITCH_TERMINAL_ID");
  const headers = await buildHeaders();
  const body = {
    customers: [
      {
        PaymentCode: paymentCode,
        CustomerId: customerId,
      },
    ],
    TerminalId: terminalId,
  };
  return axios.post(
    `${billsBaseUrl}/Transactions/validatecustomers`,
    body,
    { headers },
  );
};

export const vendPrepaid = async ({
  paymentCode,
  customerId,
  amount,
  customerMobile,
  customerEmail,
  requestReference,
}) => {
  if (!terminalId) throw new Error("Missing INTERSWITCH_TERMINAL_ID");
  const headers = await buildHeaders();
  const unit = getAmountUnit();
  const formattedAmount = formatAmount(amount);
  console.log("Bills: vend request", {
    paymentCode,
    customerId,
    amountRaw: amount,
    amountUnit: unit,
    amountFormatted: formattedAmount,
    requestReference,
  });
  const body = {
    paymentCode,
    customerId,
    customerMobile,
    customerEmail,
    amount: formattedAmount,
    requestReference,
  };
  return axios.post(`${billsBaseUrl}/Transactions`, body, { headers });
};
