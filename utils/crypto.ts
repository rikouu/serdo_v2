/**
 * 加密工具 - 使用 WebCrypto API 进行 AES-256-GCM 加解密
 * 
 * 用途：
 * 1. 解密从服务器获取的敏感数据（密码等）
 * 2. 所有加密在服务器端完成，前端只负责解密
 */

/**
 * Base64 解码为字节数组
 */
export function b64ToBytes(b64: string): Uint8Array {
  try {
    const binaryString = atob(b64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch {
    throw new Error('Base64 解码失败')
  }
}

/**
 * 字节数组编码为 Base64
 */
export function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 加密数据结构
 */
export interface EncryptedData {
  iv: string    // 初始化向量 (Base64)
  tag: string   // 认证标签 (Base64)
  data: string  // 加密数据 (Base64)
}

/**
 * 解密 AES-256-GCM 加密的数据
 * 
 * @param keyB64 - Base64 编码的 256 位密钥
 * @param encrypted - 加密数据对象
 * @returns 解密后的明文字符串
 */
export async function decryptSecret(
  keyB64: string,
  encrypted: EncryptedData
): Promise<string> {
  // 验证输入
  if (!keyB64 || !encrypted.iv || !encrypted.tag || !encrypted.data) {
    throw new Error('解密参数不完整')
  }
  
  try {
    // 解码所有 Base64 数据
    const keyBytes = b64ToBytes(keyB64)
    const iv = b64ToBytes(encrypted.iv)
    const tag = b64ToBytes(encrypted.tag)
    const data = b64ToBytes(encrypted.data)
    
    // 验证密钥长度（256 位 = 32 字节）
    if (keyBytes.length !== 32) {
      throw new Error(`密钥长度错误: ${keyBytes.length} 字节，需要 32 字节`)
    }
    
    // 合并数据和认证标签（WebCrypto 需要）
    const combined = new Uint8Array(data.length + tag.length)
    combined.set(data)
    combined.set(tag, data.length)
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    // 解密
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      combined
    )
    
    // 转换为字符串
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'OperationError') {
        throw new Error('解密失败：密钥不匹配或数据已损坏')
      }
      throw error
    }
    throw new Error('解密失败')
  }
}

/**
 * 用于兼容旧代码的别名
 * @deprecated 请使用 decryptSecret
 */
export async function aesGcmDecryptBase64(
  keyB64: string,
  ivB64: string,
  tagB64: string,
  dataB64: string
): Promise<string> {
  return decryptSecret(keyB64, { iv: ivB64, tag: tagB64, data: dataB64 })
}

/**
 * 生成随机字节（用于生成密钥）
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * 生成 Base64 编码的随机密钥
 */
export function generateRandomKey(bytes = 32): string {
  return bytesToB64(generateRandomBytes(bytes).buffer)
}
