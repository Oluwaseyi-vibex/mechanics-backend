import prisma from "../../config/prisma.js";

export const listMeters = async (userId) => {
  return prisma.meter.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const getMeterByNumber = async (userId, meterNumber) => {
  return prisma.meter.findFirst({
    where: { userId, meterNumber },
  });
};
