/**
 * API适配器基类
 * 定义了所有适配器必须实现的接口
 */
class BaseApiAdapter {
  /**
   * 将通用消息格式转换为特定API的请求格式
   * @param {Array} messages - 消息数组
   * @param {string} model - 模型ID
   * @param {Object} config - 额外配置
   * @returns {Object} API请求体
   */
  formatRequest(messages, model, config = {}) {
    throw new Error('formatRequest must be implemented');
  }

  /**
   * 将API响应转换为通用格式
   * @param {Object} response - API响应
   * @returns {Object} 标准化的响应对象
   */
  parseResponse(response) {
    throw new Error('parseResponse must be implemented');
  }

  /**
   * 处理流式响应的单个chunk
   * @param {string} chunk - SSE数据块
   * @returns {Object|null} 解析后的数据或null
   */
  parseStreamChunk(chunk) {
    throw new Error('parseStreamChunk must be implemented');
  }
}

/**
 * OpenAI格式适配器
 * 用于本地代理和兼容OpenAI格式的服务
 */
class OpenAIAdapter extends BaseApiAdapter {
  formatRequest(messages, model, config = {}) {
    return {
      model,
      messages: messages.map(msg => {
        // 如果消息包含图片，使用 OpenAI Vision 格式
        if (msg.images && msg.images.length > 0) {
          const contentArr = [{ type: 'text', text: msg.content || '' }];
          msg.images.forEach(img => {
            contentArr.push({
              type: 'image_url',
              image_url: { url: img }
            });
          });
          return { role: msg.role, content: contentArr };
        }
        // 普通文本消息
        return {
          role: msg.role,
          content: msg.content
        };
      }),
      stream: config.stream !== false,
      ...config
    };
  }

  parseResponse(response) {
    if (!response || !response.choices || !response.choices[0]) {
      throw new Error('Invalid response format');
    }

    const choice = response.choices[0];
    return {
      content: choice.message?.content || '',
      role: choice.message?.role || 'assistant',
      model: response.model
    };
  }

  parseStreamChunk(chunk) {
    if (!chunk || chunk === '[DONE]') {
      return { content: '', done: true };
    }

    try {
      const data = JSON.parse(chunk);
      const delta = data.choices?.[0]?.delta;

      if (!delta) {
        return null;
      }

      return {
        content: delta.content || '',
        done: data.choices?.[0]?.finish_reason !== null
      };
    } catch (e) {
      console.error('Failed to parse stream chunk:', e);
      return null;
    }
  }
}

/**
 * Wong公益站适配器
 * 目前与OpenAI格式相同，预留扩展空间
 */
class WongAdapter extends OpenAIAdapter {
  // 如果Wong的格式与OpenAI完全相同，直接继承
  // 如果有差异，可以在这里重写相应方法

  formatRequest(messages, model, config = {}) {
    // 可以在这里添加Wong特有的参数处理
    const request = super.formatRequest(messages, model, config);

    // 示例：添加Wong特有的参数
    // request.wong_specific_param = config.wongParam;

    return request;
  }
}

/**
 * AnyRouter适配器
 * 处理AnyRouter特有的格式
 */
class AnyRouterAdapter extends OpenAIAdapter {
  formatRequest(messages, model, config = {}) {
    const request = super.formatRequest(messages, model, config);

    // AnyRouter可能需要特殊的参数
    // 如果模型有metadata，可以在这里处理
    if (config.metadata) {
      // 可以根据需要添加AnyRouter特有的参数
      // request.model_ratio = config.metadata.model_ratio;
    }

    return request;
  }

  parseResponse(response) {
    // AnyRouter的响应格式可能与OpenAI略有不同
    // 如果相同，直接使用父类方法
    return super.parseResponse(response);
  }

  parseStreamChunk(chunk) {
    // AnyRouter的流式响应格式可能与OpenAI略有不同
    // 如果相同，直接使用父类方法
    return super.parseStreamChunk(chunk);
  }
}

/**
 * API适配器工厂
 * 根据适配器类型创建对应的适配器实例
 */
class ApiAdapterFactory {
  static adapters = {
    openai: new OpenAIAdapter(),
    wong: new WongAdapter(),
    anyrouter: new AnyRouterAdapter()
  };

  /**
   * 获取指定类型的适配器
   * @param {string} adapterType - 适配器类型
   * @returns {BaseApiAdapter} 适配器实例
   */
  static getAdapter(adapterType) {
    const adapter = this.adapters[adapterType];
    if (!adapter) {
      console.warn(`Unknown adapter type: ${adapterType}, falling back to OpenAI`);
      return this.adapters.openai;
    }
    return adapter;
  }

  /**
   * 注册新的适配器
   * @param {string} type - 适配器类型
   * @param {BaseApiAdapter} adapter - 适配器实例
   */
  static registerAdapter(type, adapter) {
    if (!(adapter instanceof BaseApiAdapter)) {
      throw new Error('Adapter must extend BaseApiAdapter');
    }
    this.adapters[type] = adapter;
  }
}

export {
  BaseApiAdapter,
  OpenAIAdapter,
  WongAdapter,
  AnyRouterAdapter,
  ApiAdapterFactory
};

export default ApiAdapterFactory;
