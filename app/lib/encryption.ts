import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY

  if (!rawKey) {
    throw new Error("ENCRYPTION_KEY is not configured")
  }

  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)",
    )
  }

  return Buffer.from(rawKey, "hex")
}

export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag().toString("hex")

  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export function decrypt(stored: string): string {
  const key = getEncryptionKey()

  const [ivHex, authTagHex, encrypted] = stored.split(":")

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted value")
  }

  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}