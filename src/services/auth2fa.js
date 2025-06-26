import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const generate2FASecret = (email) => {
  const secret = speakeasy.generateSecret({
    name: `MyApp (${email})`,
    issuer: "MyApp"
  });
  return secret;
};

export const generateQRCode = async (otpauthUrl) => {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (err) {
    console.error("QR generation failed:", err);
    return null;
  }
};

export const verify2FACode = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
};