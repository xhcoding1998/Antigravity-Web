/**
 * 模型服务 - 负责从API获取模型列表
 */

/**
 * 从API获取模型列表
 * @param {string} baseUrl - API基础地址
 * @param {string} apiKey - API密钥
 * @param {string} endpoint - API端点，默认为 /v1/models
 * @returns {Promise<Array>} 模型列表
 * @throws {Error} API调用失败时抛出错误
 */
export async function fetchModels(baseUrl, apiKey, endpoint = '/v1/models') {
  if (!baseUrl || !apiKey) {
    throw new Error('API基础地址和密钥不能为空');
  }

  // 规范化URL
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const fullUrl = `${normalizedBaseUrl}${normalizedEndpoint}`;

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // 尝试解析错误响应
      let errorMessage = `HTTP错误: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // 如果无法解析JSON，使用默认错误消息
        const textError = await response.text();
        if (textError) {
          errorMessage = textError;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // 验证响应格式
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('API返回数据格式不正确，缺少data数组');
    }

    // 格式化模型数据
    return formatModelData(data.data);

  } catch (error) {
    // 网络错误或其他错误
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('无法连接到API服务器，请检查网络连接和API地址');
    }
    throw error;
  }
}

/**
 * 格式化API返回的模型数据为应用内部格式
 * @param {Array} apiModels - API返回的原始模型数据
 * @returns {Array} 格式化后的模型列表
 */
export function formatModelData(apiModels) {
  if (!Array.isArray(apiModels)) {
    return [];
  }

  return apiModels.map(model => {
    // 基础模型信息
    const formattedModel = {
      id: model.id,
      name: generateModelName(model.id),
      desc: generateModelDescription(model.id)
    };

    // 如果有额外的元数据，也保存下来
    if (model.metadata) {
      formattedModel.metadata = model.metadata;
    }

    return formattedModel;
  });
}

/**
 * 根据模型ID生成友好的模型名称
 * @param {string} modelId - 模型ID
 * @returns {string} 模型名称
 */
function generateModelName(modelId) {
  // 将模型ID转换为更友好的显示名称
  // 例如: "gpt-4o" -> "GPT-4o"
  //      "claude-3-5-sonnet-20240620" -> "Claude 3.5 Sonnet"
  //      "gemini-2.5-flash" -> "Gemini 2.5 Flash"

  if (!modelId) return 'Unknown Model';

  // Claude模型处理
  if (modelId.startsWith('claude-')) {
    const parts = modelId.split('-');
    let name = 'Claude';

    // 提取版本号和型号
    // 支持格式: claude-3-5-sonnet, claude-sonnet-4-20250514, claude-opus-4-5-20251101
    let version = '';

    // 查找连续的数字部分，可能是 "3-5" 或 "4" 或 "4-5" 格式
    for (let i = 0; i < parts.length - 1; i++) {
      if (/^\d+$/.test(parts[i])) {
        version = parts[i];
        // 检查下一个部分是否也是数字，且小于10（避免将日期误识别为版本号）
        // 例如: 3-5 中的 5 是版本号，但 4-20250514 中的 20250514 是日期
        if (i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) {
          const nextNum = parseInt(parts[i + 1]);
          if (nextNum < 10) {
            version += '.' + parts[i + 1];
          }
        }
        break;
      }
    }

    // 提取型号
    if (parts.includes('opus')) {
      name += version ? ` ${version} Opus` : ' Opus';
    } else if (parts.includes('sonnet')) {
      name += version ? ` ${version} Sonnet` : ' Sonnet';
    } else if (parts.includes('haiku')) {
      name += version ? ` ${version} Haiku` : ' Haiku';
    }

    // 添加thinking标识
    if (modelId.includes('thinking')) {
      name += ' (Thinking)';
    }

    return name;
  }

  // Gemini模型处理
  if (modelId.startsWith('gemini-')) {
    const parts = modelId.split('-');
    let name = 'Gemini';

    // 提取版本号
    const versionMatch = modelId.match(/(\d+(?:\.\d+)?)/);
    if (versionMatch) {
      name += ` ${versionMatch[1]}`;
    }

    // 提取型号
    if (parts.includes('flash')) {
      name += ' Flash';
    } else if (parts.includes('pro')) {
      name += ' Pro';
    }

    // 添加特殊标识
    if (modelId.includes('thinking')) {
      name += ' (Thinking)';
    } else if (modelId.includes('lite')) {
      name += ' Lite';
    } else if (modelId.includes('image')) {
      // 提取图片比例
      const ratioMatch = modelId.match(/(\d+x\d+)/);
      if (ratioMatch) {
        name += ` (Image ${ratioMatch[1]})`;
      } else {
        name += ' (Image)';
      }
    } else if (modelId.includes('high')) {
      name += ' High';
    } else if (modelId.includes('low')) {
      name += ' Low';
    }

    return name;
  }

  // GPT模型处理
  if (modelId.startsWith('gpt-')) {
    let name = modelId.toUpperCase();

    // 移除日期后缀
    name = name.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    name = name.replace(/-\d{8}$/, '');

    // 格式化
    name = name.replace(/GPT-(\d+)/, 'GPT-$1');

    return name;
  }

  // 默认处理：首字母大写，替换连字符为空格
  return modelId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 根据模型ID生成模型描述
 * @param {string} modelId - 模型ID
 * @returns {string} 模型描述
 */
function generateModelDescription(modelId) {
  if (!modelId) return '';

  // 根据模型特征生成描述
  if (modelId.includes('thinking')) {
    return '深度思维推理模型';
  }

  if (modelId.includes('image')) {
    const ratioMatch = modelId.match(/(\d+x\d+)/);
    if (ratioMatch) {
      return `图片生成 (${ratioMatch[1]})`;
    }
    return '图片生成模型';
  }

  if (modelId.includes('flash')) {
    return '快速响应模型';
  }

  if (modelId.includes('opus')) {
    return '最强推理能力';
  }

  if (modelId.includes('sonnet')) {
    return '平衡性能模型';
  }

  if (modelId.includes('haiku')) {
    return '轻量快速模型';
  }

  if (modelId.includes('pro')) {
    if (modelId.includes('high')) {
      return '高性能专业版';
    } else if (modelId.includes('low')) {
      return '轻量专业版';
    }
    return '专业版模型';
  }

  if (modelId.includes('turbo')) {
    return '快速高效模型';
  }

  if (modelId.includes('mini')) {
    return '轻量级模型';
  }

  return '通用AI模型';
}

export default {
  fetchModels,
  formatModelData
};
