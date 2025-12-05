import { GoogleGenAI } from "@google/genai";
import { Server, Domain, Language } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeInfrastructure = async (servers: Server[], domains: Domain[], lang: Language = 'en'): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return lang === 'zh' ? "错误：未找到 API 密钥。" : "Error: Gemini API Key is missing.";

  const langInstruction = lang === 'zh' ? "Please output the report in Chinese (Simplified)." : "Please output the report in English.";

  const prompt = `
    You are an expert infrastructure manager (DevOps). I will provide you with a JSON list of Servers and Domains.
    Please analyze them and produce a concise, actionable report in Markdown format.
    ${langInstruction}

    Focus on:
    1. **Expiration Risks**: Identify items expiring in the next 30 days.
    2. **Cost/Consolidation**: Suggest if any servers look underutilized or redundant based on their names/status (e.g., 'stopped' servers).
    3. **Inconsistencies**: Check if domains point to servers that don't exist or if DNS records look odd.
    4. **Security**: Note any servers with weak descriptions or missing updates based on the 'OS' version (e.g. old Ubuntu/CentOS).

    Data:
    Servers: ${JSON.stringify(servers.map(s => ({...s, password: 'REDACTED', providerPassword: 'REDACTED'})))}
    Domains: ${JSON.stringify(domains)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || (lang === 'zh' ? "未生成分析。" : "No analysis generated.");
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return lang === 'zh' ? "分析生成失败，请稍后重试。" : "Failed to generate analysis. Please try again later.";
  }
};
