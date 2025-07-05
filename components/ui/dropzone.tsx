import type React from 'react';
import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileUp } from 'lucide-react';


interface DropzoneProps {
    onChange: (file: File | null) => void;
    className?: string;
    fileExtensions?: string[];
    inputPlaceholder?: React.ReactNode;
}
// 创建 Dropzone 组件，接收定义的属性
export function Dropzone({
    onChange,
    className,
    fileExtensions,
    inputPlaceholder,
    ...props
}: DropzoneProps) {
    // 使用 useRef 钩子初始化文件输入元素的引用
    const fileInputRef = useRef<HTMLInputElement | null>(null); 
    const [error, setError] = useState<string | null>(null); 
    // 处理拖拽到该区域上的事件
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    // 处理释放拖拽文件到该区域的事件
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const { files } = e.dataTransfer;
        handleFiles(files);
    };

    // 处理文件输入框改变事件
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target;
        if (files) {
            handleFiles(files);
        }
    };

    // 处理上传文件的函数
    const handleFiles = (files: FileList) => {
        if (files.length > 1) {
            setError("You can only upload one file at a time");
            return;
        }
        const uploadedFile = files[0];
        // 检查文件扩展名是否符合要求
        if (fileExtensions && !fileExtensions.some(fileExtension => uploadedFile.name.endsWith(fileExtension))) {
            // if (fileExtensions && !uploadedFile.name.endsWith(`${fileExtension}`)) {
            setError(`Invalid file type. Expected: ${fileExtensions.join(', ')}`);
            return;
        }

        onChange(uploadedFile); // 直接传递 File 对象给 onChange 回调

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setError(null); // 重置错误状态
    };
    // 模拟点击文件输入元素的函数
    const handleButtonClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    // 渲染组件
    return (
        <Card
            className={`border-2 border-dashed bg-muted hover:cursor-pointer hover:border-muted-foreground/50 w-full flex items-center justify-center ${className}`}
            {...props}
            onClick={handleButtonClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <CardContent
                className="flex flex-col items-center justify-center space-y-4 px-2 py-4 text-medium"
            >
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                    {inputPlaceholder ? (
                        <>
                            <span className="font-medium">{inputPlaceholder}</span>
                            <FileUp className="size-8 mt-2" />
                        </>
                    ) : (
                        <div className="flex items-center">
                            <span className="font-medium mr-2">Drag Files to Upload</span>
                            <FileUp className="size-6" />
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={`${fileExtensions}`}
                        onChange={handleFileInputChange}
                        className="hidden"
                        multiple={false}
                    />
                </div>

                {error && <span className="text-red-500">{error}</span>}
            </CardContent>
        </Card>
    );
}
