export const b64ToBytes = (b64: string) => {
  try {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  } catch (error) {
    console.error('❌ [b64ToBytes] Base64 解码失败:', error)
    throw new Error('Invalid base64 string')
  }
}

export const bytesToB64 = (buf: ArrayBuffer) => {
  try {
    const u8 = new Uint8Array(buf)
    let s = ''
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
    return btoa(s)
  } catch (error) {
    console.error('❌ [bytesToB64] Base64 编码失败:', error)
    throw new Error('Failed to encode to base64')
  }
}

export async function aesGcmDecryptBase64(keyB64: string, ivB64: string, tagB64: string, dataB64: string): Promise<string> {
  console.log('🔓 [Decrypt] 开始解密:', {
    keyLength: keyB64?.length || 0,
    ivLength: ivB64?.length || 0,
    tagLength: tagB64?.length || 0,
    dataLength: dataB64?.length || 0
  })
  
  try {
    // 验证输入参数
    if (!keyB64 || !ivB64 || !tagB64 || !dataB64) {
      const missing = []
      if (!keyB64) missing.push('key')
      if (!ivB64) missing.push('iv')
      if (!tagB64) missing.push('tag')
      if (!dataB64) missing.push('data')
      throw new Error(`Missing parameters: ${missing.join(', ')}`)
    }
    
    // 解码 Base64
    const keyRaw = b64ToBytes(keyB64)
    const iv = b64ToBytes(ivB64)
    const tag = b64ToBytes(tagB64)
    const data = b64ToBytes(dataB64)
    
    console.log('🔓 [Decrypt] Base64 解码成功:', {
      keyBytes: keyRaw.length,
      ivBytes: iv.length,
      tagBytes: tag.length,
      dataBytes: data.length
    })
    
    // 验证密钥长度
    if (keyRaw.length !== 32) {
      throw new Error(`Invalid key length: ${keyRaw.length}, expected 32 bytes`)
    }
    
    // 合并数据和标签
    const combined = new Uint8Array(data.length + tag.length)
    combined.set(data)
    combined.set(tag, data.length)
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw', 
      keyRaw, 
      { name: 'AES-GCM' }, 
      false, 
      ['decrypt']
    )
    
    console.log('🔓 [Decrypt] 密钥导入成功，开始解密...')
    
    // 解密
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, 
      cryptoKey, 
      combined
    )
    
    // 转换为字符串
    const u8 = new Uint8Array(pt)
    let s = ''
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
    
    console.log('✅ [Decrypt] 解密成功，长度:', s.length)
    
    // 验证结果不为空
    if (!s || s.trim() === '') {
      console.warn('⚠️ [Decrypt] 解密结果为空字符串')
    }
    
    return s
  } catch (error: any) {
    console.error('❌ [Decrypt] 解密失败:', {
      error: error.message,
      name: error.name,
      stack: error.stack
    })
    
    // 提供更友好的错误信息
    if (error.name === 'OperationError') {
      throw new Error('解密失败：密钥不匹配或数据已损坏')
    } else if (error.message.includes('base64')) {
      throw new Error('解密失败：数据格式错误')
    } else if (error.message.includes('key length')) {
      throw new Error('解密失败：密钥长度错误')
    }
    
    throw error
  }
}
