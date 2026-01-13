/**
 * 文件解析工具 - 支持 PDF、Excel、PPT、Text、Markdown 等文件格式的文本提取
 */

import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// 设置 PDF.js worker - 使用本地 worker 文件
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * 支持的文件类型及其 MIME 类型
 */
export const SUPPORTED_FILE_TYPES = {
    // 文档类型
    pdf: ['application/pdf'],
    // PowerPoint 类型
    pptx: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint'
    ],
    // Excel 类型
    excel: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.spreadsheet'
    ],
    // Word 类型
    word: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ],
    // 文本类型
    text: [
        'text/plain',
        'text/markdown',
        'text/csv',
        'text/html',
        'text/xml',
        'application/json',
        'application/xml'
    ],
    // 代码文件（按扩展名识别）
    code: [
        '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.java', '.c', '.cpp', '.h',
        '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.sql',
        '.sh', '.bash', '.zsh', '.ps1', '.yaml', '.yml', '.toml', '.ini', '.cfg'
    ]
};

/**
 * 获取所有支持的 MIME 类型和扩展名（用于 input accept）
 */
export const getAcceptedFileTypes = () => {
    const mimeTypes = [
        ...SUPPORTED_FILE_TYPES.pdf,
        ...SUPPORTED_FILE_TYPES.pptx,
        ...SUPPORTED_FILE_TYPES.excel,
        ...SUPPORTED_FILE_TYPES.word,
        ...SUPPORTED_FILE_TYPES.text
    ];
    const extensions = [
        '.pdf', '.pptx', '.ppt', '.xlsx', '.xls', '.docx', '.doc',
        '.csv', '.txt', '.md', '.json', '.xml', '.html',
        ...SUPPORTED_FILE_TYPES.code
    ];
    return [...mimeTypes, ...extensions].join(',');
};

/**
 * 检查文件是否支持
 */
export const isFileSupported = (file) => {
    const mimeType = file.type;
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    // 检查 MIME 类型
    const allMimeTypes = [
        ...SUPPORTED_FILE_TYPES.pdf,
        ...SUPPORTED_FILE_TYPES.pptx,
        ...SUPPORTED_FILE_TYPES.excel,
        ...SUPPORTED_FILE_TYPES.word,
        ...SUPPORTED_FILE_TYPES.text
    ];
    if (allMimeTypes.includes(mimeType)) return true;

    // 检查扩展名
    const allExtensions = [
        '.pdf', '.pptx', '.ppt', '.xlsx', '.xls', '.docx', '.doc',
        '.csv', '.txt', '.md', '.json', '.xml', '.html',
        ...SUPPORTED_FILE_TYPES.code
    ];
    if (allExtensions.includes(extension)) return true;

    return false;
};

/**
 * 解析 PDF 文件
 */
const parsePDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `[第 ${pageNum} 页]\n${pageText}\n\n`;
    }

    return {
        type: 'pdf',
        name: file.name,
        pages: totalPages,
        content: fullText.trim()
    };
};

/**
 * 解析 PPTX 文件
 */
const parsePPTX = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let fullText = '';
    let slideCount = 0;

    // 获取所有幻灯片文件
    const slideFiles = Object.keys(zip.files)
        .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml$/)[1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml$/)[1]);
            return numA - numB;
        });

    for (const slidePath of slideFiles) {
        slideCount++;
        const slideXml = await zip.file(slidePath).async('text');

        // 提取文本内容 - 匹配 <a:t> 标签中的文本
        const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
        const texts = textMatches.map(match => {
            const content = match.replace(/<a:t>([^<]*)<\/a:t>/, '$1');
            return content.trim();
        }).filter(t => t);

        if (texts.length > 0) {
            fullText += `[幻灯片 ${slideCount}]\n${texts.join('\n')}\n\n`;
        }
    }

    return {
        type: 'pptx',
        name: file.name,
        slides: slideCount,
        content: fullText.trim() || '(无文本内容)'
    };
};

/**
 * 解析 DOCX 文件
 */
const parseDOCX = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 获取主文档内容
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) {
        throw new Error('无法读取文档内容');
    }

    // 提取文本内容 - 匹配 <w:t> 标签中的文本
    const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const paragraphs = [];
    let currentParagraph = '';

    for (const match of textMatches) {
        const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
        currentParagraph += content;
    }

    // 简单地按段落分隔
    const fullText = docXml
        .split(/<w:p[^>]*>/)
        .map(p => {
            const texts = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
                .map(m => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
                .join('');
            return texts.trim();
        })
        .filter(t => t)
        .join('\n\n');

    return {
        type: 'docx',
        name: file.name,
        content: fullText || '(无文本内容)'
    };
};

/**
 * 解析 Excel 文件
 */
const parseExcel = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let fullText = '';
    const sheetNames = workbook.SheetNames;

    for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        // 转换为 CSV 格式，更易于 AI 理解
        const csv = XLSX.utils.sheet_to_csv(worksheet);

        fullText += `[工作表: ${sheetName}]\n`;
        fullText += csv + '\n\n';
    }

    return {
        type: 'excel',
        name: file.name,
        sheets: sheetNames.length,
        content: fullText.trim()
    };
};

/**
 * 解析文本文件（包括代码文件）
 */
const parseText = async (file) => {
    const text = await file.text();
    const extension = file.name.split('.').pop().toLowerCase();

    // 判断是否是代码文件
    const isCode = SUPPORTED_FILE_TYPES.code.includes('.' + extension);

    return {
        type: isCode ? 'code' : 'text',
        name: file.name,
        extension: extension,
        content: text
    };
};

/**
 * 主解析函数 - 根据文件类型自动选择解析器
 */
export const parseFile = async (file) => {
    const mimeType = file.type;
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    try {
        // PDF 文件
        if (SUPPORTED_FILE_TYPES.pdf.includes(mimeType) || extension === '.pdf') {
            return await parsePDF(file);
        }

        // PPTX 文件
        if (SUPPORTED_FILE_TYPES.pptx.includes(mimeType) || ['.pptx', '.ppt'].includes(extension)) {
            return await parsePPTX(file);
        }

        // DOCX 文件
        if (SUPPORTED_FILE_TYPES.word.includes(mimeType) || ['.docx', '.doc'].includes(extension)) {
            return await parseDOCX(file);
        }

        // Excel 文件
        if (SUPPORTED_FILE_TYPES.excel.includes(mimeType) ||
            ['.xlsx', '.xls', '.ods'].includes(extension)) {
            return await parseExcel(file);
        }

        // 文本/代码文件
        if (SUPPORTED_FILE_TYPES.text.includes(mimeType) ||
            SUPPORTED_FILE_TYPES.code.includes(extension) ||
            ['.txt', '.md', '.csv', '.json', '.xml', '.html'].includes(extension)) {
            return await parseText(file);
        }

        // 尝试作为文本解析
        return await parseText(file);

    } catch (error) {
        console.error(`解析文件 ${file.name} 失败:`, error);
        throw new Error(`无法解析文件 "${file.name}": ${error.message}`);
    }
};

/**
 * 批量解析多个文件
 */
export const parseFiles = async (files) => {
    const results = [];
    const errors = [];

    for (const file of files) {
        try {
            const result = await parseFile(file);
            results.push(result);
        } catch (error) {
            errors.push({
                name: file.name,
                error: error.message
            });
        }
    }

    return { results, errors };
};

/**
 * 格式化文件内容，准备发送给 AI
 * 使用特殊标记，便于前端渲染成可折叠卡片
 */
export const formatFileContentForAI = (parsedFiles) => {
    if (!parsedFiles || parsedFiles.length === 0) return '';

    let formatted = '\n\n';

    for (const file of parsedFiles) {
        // 使用特殊标记包裹附件内容，便于前端识别和美化渲染
        formatted += `<!--ATTACHMENT_START-->\n`;
        formatted += `<!--ATTACHMENT_META:${JSON.stringify({
            name: file.name,
            type: file.type,
            pages: file.pages,
            slides: file.slides,
            sheets: file.sheets,
            extension: file.extension
        })}-->\n`;

        // 如果是代码文件，使用代码块
        if (file.type === 'code') {
            formatted += '```' + file.extension + '\n';
            formatted += file.content;
            formatted += '\n```\n';
        } else {
            formatted += file.content + '\n';
        }

        formatted += `<!--ATTACHMENT_END-->\n\n`;
    }

    return formatted;
};

/**
 * 获取文件图标（用于 UI 显示）
 */
export const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();

    const iconMap = {
        pdf: '📕',
        pptx: '📙',
        ppt: '📙',
        docx: '📘',
        doc: '📘',
        xlsx: '📊',
        xls: '📊',
        csv: '📊',
        txt: '📝',
        md: '📝',
        json: '📋',
        xml: '📋',
        html: '🌐',
        js: '💻',
        ts: '💻',
        jsx: '⚛️',
        tsx: '⚛️',
        vue: '💚',
        py: '🐍',
        java: '☕',
        cpp: '⚙️',
        c: '⚙️',
        go: '🐹',
        rs: '🦀',
        rb: '💎',
        php: '🐘',
        swift: '🍎',
        kt: '🟣',
        sql: '🗃️',
        sh: '🖥️',
        yaml: '⚙️',
        yml: '⚙️'
    };

    return iconMap[extension] || '📄';
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 获取文件类型描述
 */
export const getFileTypeDescription = (fileInfo) => {
    if (fileInfo.type === 'pdf') {
        return `PDF 文档, ${fileInfo.pages} 页`;
    } else if (fileInfo.type === 'pptx') {
        return `PPT 演示文稿, ${fileInfo.slides} 页`;
    } else if (fileInfo.type === 'docx') {
        return `Word 文档`;
    } else if (fileInfo.type === 'excel') {
        return `Excel 表格, ${fileInfo.sheets} 个工作表`;
    } else if (fileInfo.type === 'code') {
        return `${fileInfo.extension?.toUpperCase() || ''} 代码文件`;
    } else {
        return `文本文件`;
    }
};
