import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";

export const registerUser = async ({
  businessName,
  email,
  phone,
  password,
  meterNumber,
}) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");

  const existingMeter = await prisma.meter.findUnique({
    where: { meterNumber },
  });
  if (existingMeter) throw new Error("Meter number already in use");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      businessName,
      email,
      phone,
      passwordHash,
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

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true },
  });

  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const token = generateToken(user);
  return { user: sanitize(user), token };
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
