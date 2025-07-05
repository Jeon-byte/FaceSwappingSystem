// pages/api/upload.ts
import { type NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { UPLOAD_PREVIEW_IMAGES_PATH } from '@/app/constants'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        // 获取上传的文件对象
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ message: 'No file uploaded' }, { status: 400 })
        }
        const fileName = `${Date.now()}-${file.name}`
        const publicPath = path.join(process.cwd(), "public", UPLOAD_PREVIEW_IMAGES_PATH);
        // 检查上传目录是否存在，如果不存在则创建
        try {
            await fs.stat(publicPath)
        } catch (error: unknown) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                await fs.mkdir(publicPath, { recursive: true })
            }
        }
        // 读取文件的二进制数据
        const rawData = await file.arrayBuffer();
        await fs.writeFile(path.join(publicPath, fileName), Buffer.from(rawData))
       // 构建文件的公共URL
        const fileUrl = `/${UPLOAD_PREVIEW_IMAGES_PATH}/${fileName}`;

        return NextResponse.json({ url: fileUrl }, { status: 200 })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: 'Error uploading file' }, { status: 500 })
    }
}
// 定义处理文件删除的 DELETE 请求的函数
export async function DELETE(request: NextRequest) {
    const { url } = await request.json()

    if (!url) {
        return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Construct the full path to the image file
    const filePath = path.join(process.cwd(), 'public', url);
    try {
        // Check if the file exists
        if ((await fs.stat(filePath)).isFile()) {
            // Delete the file
            await fs.unlink(filePath);
            return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
        } else {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }
    } catch (error) {
        // 如果删除过程中发生错误，记录错误并返回500内部服务器错
        console.error('Error deleting image:', error);
        return NextResponse.json({ error: 'Image deletion failed' }, { status: 500 });
    }
}