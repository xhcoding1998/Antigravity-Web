/**
 * 图片 OCR 工具 - 使用 Tesseract.js 提取图片中的文字
 */

import Tesseract from 'tesseract.js';

// OCR 缓存
const ocrCache = new Map();

/**
 * 从图片中提取文字
 * @param {string} imageData - base64 格式的图片数据
 * @param {string} lang - 识别语言 (默认: 'chi_sim+eng' 中英文)
 * @returns {Promise<{text: string, confidence: number}>}
 */
export const extractTextFromImage = async (imageData, lang = 'chi_sim+eng') => {
    // 检查缓存
    const cacheKey = imageData.substring(0, 100); // 使用前100个字符作为key
    if (ocrCache.has(cacheKey)) {
        return ocrCache.get(cacheKey);
    }

    try {
        const result = await Tesseract.recognize(
            imageData,
            lang,
            {
                logger: m => {
                    // 可以在这里添加进度回调
                    // console.log('OCR Progress:', m);
                }
            }
        );

        const ocrResult = {
            text: result.data.text.trim(),
            confidence: result.data.confidence
        };

        // 缓存结果
        ocrCache.set(cacheKey, ocrResult);

        return ocrResult;
    } catch (error) {
        console.error('OCR 识别失败:', error);
        return {
            text: '',
            confidence: 0,
            error: error.message
        };
    }
};

/**
 * 批量提取图片文字
 * @param {string[]} images - base64 图片数组
 * @returns {Promise<Array<{text: string, confidence: number}>>}
 */
export const extractTextFromImages = async (images) => {
    const results = [];

    for (let i = 0; i < images.length; i++) {
        const result = await extractTextFromImage(images[i]);
        results.push({
            index: i + 1,
            ...result
        });
    }

    return results;
};

/**
 * 格式化 OCR 结果为 AI 可读的文本（使用附件标记格式）
 * @param {Array} ocrResults - OCR 结果数组
 * @returns {string}
 */
export const formatOcrResultsForAI = (ocrResults) => {
    if (!ocrResults || ocrResults.length === 0) return '';

    const validResults = ocrResults.filter(r => r.text && r.text.trim().length > 0);
    if (validResults.length === 0) return '';

    let formatted = '\n\n';

    for (const result of validResults) {
        // 使用和附件一样的标记格式
        formatted += `<!--ATTACHMENT_START-->\n`;
        formatted += `<!--ATTACHMENT_META:${JSON.stringify({
            name: `图片 ${result.index} 文字识别`,
            type: 'ocr',
            confidence: Math.round(result.confidence)
        })}-->\n`;
        formatted += result.text;
        formatted += `\n<!--ATTACHMENT_END-->\n\n`;
    }

    return formatted;
};

/**
 * 清除 OCR 缓存
 */
export const clearOcrCache = () => {
    ocrCache.clear();
};
