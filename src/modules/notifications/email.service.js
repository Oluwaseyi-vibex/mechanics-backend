import nodemailer from "nodemailer";

const buildTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const connectionTimeout = Number(
    process.env.SMTP_CONNECTION_TIMEOUT || 5000,
  );
  const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT || 5000);
  const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT || 5000);

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  });
};

const getFrom = () =>
  process.env.SMTP_FROM || "Power-as-you-Go <no-reply@localhost>";

export const sendEmail = async ({ to, subject, text, html }) => {
  const transport = buildTransport();
  if (!transport) {
    console.log("Notifications: SMTP not configured, skipping email", {
      to,
      subject,
    });
    return null;
  }

  return transport.sendMail({
    from: getFrom(),
    to,
    subject,
    text,
    html,
  });
};
