import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";
// import { verifyMeter } from "../meters/vtpass.service.js";
import crypto from "crypto";
import { sendEmail } from "../notifications/email.service.js";

export const registerUser = async ({
  businessName,
  email,
  phone,
  password,
  meterNumber,
  disco,
  meterType,
}) => {
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new Error("Email already in use");

  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) throw new Error("Phone already in use");

  const existingMeter = await prisma.meter.findUnique({
    where: { meterNumber },
  });
  if (existingMeter) throw new Error("Meter number already in use");

  const DISCO_SERVICE_IDS = {
    ikedc: "ikeja-electric",
    ekedc: "eko-electric",
    aedc: "abuja-electric",
    kedco: "kano-electric",
    jed: "jos-electric",
    kaedco: "kaduna-electric",
    eedc: "enugu-electric",
    ibedc: "ibadan-electric",
    bedc: "benin-electric",
    phed: "portharcourt-electric",
    abedc: "aba-electric",
  };

  const resolveServiceId = (input) => {
    if (!input) return null;
    const key = input.toLowerCase();
    if (DISCO_SERVICE_IDS[key]) return DISCO_SERVICE_IDS[key];
    const values = Object.values(DISCO_SERVICE_IDS);
    if (values.includes(input)) return input;
    return null;
  };

  const defaultDisco = process.env.VTPASS_DEFAULT_DISCO || "ikedc";
  const defaultType = process.env.VTPASS_DEFAULT_METER_TYPE || "prepaid";
  const serviceID = resolveServiceId(disco || defaultDisco);
  const type = meterType || defaultType;

  // VTpass meter verification is temporarily disabled during registration.
  void serviceID;
  void type;

  const passwordHash = await bcrypt.hash(password, 10);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

  let user;
  try {
    user = await prisma.user.create({
      data: {
        businessName,
        email,
        phone,
        passwordHash,
        emailVerified: false,
        emailVerifyToken: hashedToken,
        emailVerifyExpires: expires,
        wallet: { create: { balance: 0 } }, // auto-create wallet on register
        meters: {
          create: {
            meterNumber,
            location: "Unknown",
          },
        },
      },
      include: { wallet: true, meters: true },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target)
        ? err.meta.target.join(", ")
        : err?.meta?.target;
      if (target?.includes("phone")) {
        throw new Error("Phone already in use");
      }
      if (target?.includes("email")) {
        throw new Error("Email already in use");
      }
      if (target?.includes("meterNumber")) {
        throw new Error("Meter number already in use");
      }
    }
    throw err;
  }

  const verifyUrlBase =
    process.env.APP_BASE_URL || "http://localhost:5000";
  const verifyLink = `${verifyUrlBase}/api/auth/verify-email?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      text: `Please verify your email: ${verifyLink}`,
      html: `<p>Please verify your email:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`,
    });
  } catch (err) {
    console.error("Auth: verification email failed", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });
  }

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true },
  });

  if (!user) throw new Error("Invalid credentials");
  if (!user.emailVerified) throw new Error("Email not verified");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

export const verifyEmail = async (token) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) throw new Error("Invalid or expired verification token");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  return sanitize(updated);
};

export const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true, meters: true },
  });
  if (!user) throw new Error("User not found");
  return sanitize(user);
};

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
};

const sanitize = (user) => {
  const { passwordHash, ...safe } = user;
  return safe;
};
