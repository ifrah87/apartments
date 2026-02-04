type SmsPayload = {
  to: string;
  body: string;
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
};

function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are missing.");
  }

  return { accountSid, authToken, fromNumber, messagingServiceSid };
}

export async function sendSms({ to, body }: SmsPayload) {
  const { accountSid, authToken, fromNumber, messagingServiceSid } = getTwilioConfig();
  const params = new URLSearchParams({ To: to, Body: body });

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    params.set("From", fromNumber);
  } else {
    throw new Error("Twilio From number or Messaging Service SID is required.");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio error: ${detail}`);
  }

  return res.json();
}
