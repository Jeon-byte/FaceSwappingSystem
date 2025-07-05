import { type NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { missingViewComfyFileError, viewComfyFileName } from '@/app/constants';
import { ErrorBase, ErrorResponseFactory, ErrorTypes } from '@/app/models/errors';
import nodemailer from 'nodemailer';

const errorResponseFactory = new ErrorResponseFactory();

// 配置邮件发送
const transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true, // 使用SSL
    auth: {
        user: 'wangtiantian0115@163.com',
        pass: 'MPhecHyNvJpkwsUS' // 使用SMTP授权码，不是邮箱密码
    }
});

// 验证SMTP连接
transporter.verify(function (error) {
    if (error) {
        console.error('SMTP连接验证失败:', error);
    } else {
        console.log('邮件服务器已就绪');
    }
});

export async function GET(request: NextRequest) {
    const viewComfyPath = path.join(process.cwd(), viewComfyFileName);
    try {
        const fileContent = await fs.readFile(viewComfyPath, 'utf8');
        return NextResponse.json({ viewComfyJSON: JSON.parse(fileContent) });
    } catch (error) {
        console.error("Files not found");
        console.error(error);

        const missingFiles: string[] = [];
        if (!await fileExists(viewComfyPath)) {
            missingFiles.push(missingViewComfyFileError);
        }

        const err = new ErrorBase({
            message: "ViewMode is missing files",
            errorType: ErrorTypes.VIEW_MODE_MISSING_FILES,
            errors: missingFiles
        });

        const responseError = errorResponseFactory.getErrorResponse(err);
        return NextResponse.json(responseError, {
            status: 500,
        });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { email, imageBase64, fileName } = await request.json();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        // 创建邮件内容,HTML
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4a6baf;">您的生成图片已准备好</h2>
                <p>感谢您使用我们的智能换脸系统，以下是您的生成结果：</p>
                <p style="margin-top: 20px; color: #666;">此邮件由系统自动发送，请勿直接回复。</p>
            </div>
        `;
        // 构造邮件选项对象，包括发件人、收件人、邮件主题、邮件正文和附件
        const mailOptions = {
            from: `"基于扩散模型的智能换脸系统" <${process.env.EMAIL_USER || 'wangtiantian0115@163.com'}>`,
            to: email,
            subject: "生成图片请见附件",
            html: emailContent,
            attachments: [
                {
                    filename: fileName,
                    content: imageBase64.split(',')[1], // 去掉Base64前缀
                    encoding: 'base64'
                }
            ]
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('邮件发送成功:', info.messageId);
       // 返回成功响应，包括消息ID
        return NextResponse.json({ 
            success: true, 
            message: 'Email sent successfully',
            messageId: info.messageId
        });
    } catch (error) {
        console.error('邮件发送失败:', error);
        
        let errorMessage = 'Failed to send email';
        if (error instanceof Error) {
            errorMessage = error.message;
            // 如果是SMTP错误，添加更多详情
            if ('responseCode' in error) {
                errorMessage += ` (SMTP code: ${error.responseCode})`;
            }
        }
       // 返回错误响应，包括错误信息和堆栈跟踪
        return NextResponse.json({ 
            success: false, 
            error: errorMessage,
            details: error instanceof Error ? error.stack : null
        }, { 
            status: 500 
        });
    }
}

// 检查文件是否存在
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}