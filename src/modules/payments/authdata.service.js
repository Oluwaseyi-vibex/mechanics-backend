import forge from "node-forge";

export const buildAuthData = ({
  pan,
  pin,
  expiryYYMM,
  cvv2,
  modulusHex,
  exponentHex,
}) => {
  const authDataCipher = `1Z${pan}Z${pin}Z${expiryYYMM}Z${cvv2}`;
  const n = new forge.jsbn.BigInteger(modulusHex, 16);
  const e = new forge.jsbn.BigInteger(exponentHex, 16);
  const publicKey = forge.pki.setRsaPublicKey(n, e);
  const encrypted = publicKey.encrypt(authDataCipher, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted).replace(/\r|\n/g, "");
};
