/* eslint-disable @next/next/no-img-element */
import {
    Settings
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Fragment, useEffect, useState } from "react";
import { Header } from "@/components/header";
import PlaygroundForm from "./playground-form";
import { Loader } from "@/components/loader";
import { usePostPlayground } from "@/hooks/playground/use-post-playground";
import { ActionType, type IViewComfy, type IViewComfyWorkflow, useViewComfy } from "@/app/providers/view-comfy-provider";
import { ErrorAlertDialog } from "@/components/ui/error-alert-dialog";
import { ApiErrorHandler } from "@/lib/api-error-handler";
import type { ResponseError } from "@/app/models/errors";
import BlurFade from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";
import WorkflowSwitcher from "@/components/workflow-switchter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PreviewOutputsImageGallery } from "@/components/images-preview"

const apiErrorHandler = new ApiErrorHandler();

function PlaygroundPageContent() {
    const [results, SetResults] = useState<{ [key: string]: { outputs: Blob, url: string }[] }>({});
    const { viewComfyState, viewComfyStateDispatcher } = useViewComfy();
    const viewMode = process.env.NEXT_PUBLIC_VIEW_MODE === "true";
    const [errorAlertDialog, setErrorAlertDialog] = useState<{ open: boolean, errorTitle: string | undefined, errorDescription: React.JSX.Element, onClose: () => void }>({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });

    useEffect(() => {
        if (viewMode) {
            const fetchViewComfy = async () => {
                try {
                    const response = await fetch("/api/playground");

                    if (!response.ok) {
                        const responseError: ResponseError =
                            await response.json();
                        throw responseError;
                    }
                    const data = await response.json();
                    viewComfyStateDispatcher({ type: ActionType.INIT_VIEW_COMFY, payload: data.viewComfyJSON });
                } catch (error: any) {
                    if (error.errorType) {
                        const responseError =
                            apiErrorHandler.apiErrorToDialog(error);
                        setErrorAlertDialog({
                            open: true,
                            errorTitle: responseError.title,
                            errorDescription: <>{responseError.description}</>,
                            onClose: () => { },
                        });
                    } else {
                        setErrorAlertDialog({
                            open: true,
                            errorTitle: "Error",
                            errorDescription: <>{error.message}</>,
                            onClose: () => { },
                        });
                    }
                }
            };
            fetchViewComfy();
        }
    }, [viewMode, viewComfyStateDispatcher]);

    const { doPost, loading } = usePostPlayground();

    // 提交表单数据并触发换脸生成请求
    function onSubmit(data: IViewComfyWorkflow) {
        const inputs: { key: string, value: string }[] = [];
        // 遍历输入常规和高级输入字段将每个输入项的键和值添加到inputs数组中
        for (const dataInputs of data.inputs) {
            for (const input of dataInputs.inputs) {
                inputs.push({ key: input.key, value: input.value });
            }
        }
        for (const advancedInput of data.advancedInputs) {
            for (const input of advancedInput.inputs) {
                inputs.push({ key: input.key, value: input.value });
            }
        }
        if (viewComfyState.currentViewComfy) {
            viewComfyStateDispatcher({
                type: ActionType.UPDATE_CURRENT_VIEW_COMFY,
                payload: {
                    ...viewComfyState.currentViewComfy,
                    viewComfyJSON: {
                        ...viewComfyState.currentViewComfy.viewComfyJSON,
                        email: data.email
                    }
                }
            });
        }
        // 构造generationData数据对象，包含输入数据、文本输出启用状态和用户数据：电子邮件地址
        const generationData = {
            inputs: inputs,
            textOutputEnabled: data.textOutputEnabled ?? false,
            email: data.email
        };
        //doPost发送换脸生成请求到后端服务
        doPost({
            viewComfy: generationData,
            workflow: viewComfyState.currentViewComfy?.workflowApiJSON,
            onSuccess: (data) => {
                // 请求成功时，调用onSetResults函数处理返回的数据
                onSetResults(data);
            }, onError: (error) => {
                // 请求失败时，调用apiErrorHandler.apiErrorToDialog函数将错误转换为对话框信息
                const errorDialog = apiErrorHandler.apiErrorToDialog(error);
                setErrorAlertDialog({
                    open: true,
                    errorTitle: errorDialog.title,
                    errorDescription: <> {errorDialog.description} </>,
                    onClose: () => {
                        setErrorAlertDialog({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
                    }
                });
            }
        });
    }
    //处理从服务器接收到的生成结果数据
    const onSetResults = (data: Blob[]) => {
        const timestamp = Date.now();
        const newGeneration = data.map((output) => ({ outputs: output, url: URL.createObjectURL(output) }));
        SetResults((prevResults) => ({
            [timestamp]: newGeneration,
            ...prevResults
        }));
    };

    useEffect(() => {
        return () => {
            for (const generation of Object.values(results)) {
                for (const output of generation) {
                    URL.revokeObjectURL(output.url);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSelectChange = (data: IViewComfy) => {
        return viewComfyStateDispatcher({
            type: ActionType.UPDATE_CURRENT_VIEW_COMFY,
            payload: { ...data }
        });
    }
    //保存生成的图片
    const handleSaveImage = (url: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
    };
    //删除生成的图片
    const handleDeleteImage = (timestamp: string, index: number) => {
        SetResults(prevResults => {
            const newResults = { ...prevResults };
            newResults[timestamp] = newResults[timestamp].filter((_, i) => i !== index);
            return newResults;
        });
    };
    //邮件发送生成的图片
    const handleSendEmail = async (imageUrl: string, fileName: string) => {
        try {
            // 从组件状态中获取当前视图的电子邮件地址
            const email = viewComfyState.currentViewComfy?.viewComfyJSON.email;
            if (!email) {
                alert('Please enter an email address');
                return;
            }
            // 将图片转换为Base64格式的字符串
            const imageBase64 = await fetchAndConvertToBase64(imageUrl);
            // 发起一个 POST 请求到服务器的 /api/playground 端点
            const response = await fetch('/api/playground', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    imageBase64: imageBase64,
                    fileName: fileName
                }),
            });
            //提示框
            if (!response.ok) {
                throw new Error('Failed to send email');
            }
            alert('Email sent successfully');
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to send email');
        }
    };
    // 获取图片并转换为Base64格式
    const fetchAndConvertToBase64 = async (imageUrl: string): Promise<string> => {
        // 获取图片的 Blob 数据
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.readAsDataURL(blob);
        });
    };
    if (!viewComfyState.currentViewComfy) {
        return <>
            <div className="flex flex-col h-screen">
                <ErrorAlertDialog open={errorAlertDialog.open} errorTitle={errorAlertDialog.errorTitle} errorDescription={errorAlertDialog.errorDescription} onClose={errorAlertDialog.onClose} />
            </div>
        </>;
    }
    return (
        <>
            <div className="flex flex-col h-full">
                <div className="md:hidden w-full flex pl-4 gap-x-2">
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden self-bottom w-[85px] gap-1">
                                <Settings className="size-4" />
                                Settings
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="max-h-[80vh] gap-4 px-4 h-full">
                            <PlaygroundForm viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} onSubmit={onSubmit} loading={loading} />
                        </DrawerContent>
                    </Drawer>
                </div>
                <main className="grid overflow-hidden flex-1 gap-4 p-2 md:grid-cols-2 lg:grid-cols-3">
                    <div className="relative hidden flex-col items-start gap-8 md:flex overflow-hidden">
                        {viewComfyState.viewComfys.length > 0 && viewComfyState.currentViewComfy && (
                            <div className="px-3 w-full">
                                <WorkflowSwitcher viewComfys={viewComfyState.viewComfys} currentViewComfy={viewComfyState.currentViewComfy} onSelectChange={onSelectChange} />
                            </div>
                        )}
                        {/* 如果当前工作流存在，则显示 PlaygroundForm 表单 */}
                        {viewComfyState.currentViewComfy && <PlaygroundForm viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} onSubmit={onSubmit} loading={loading} />}

                    </div>
                    <div className="relative h-full min-h-[50vh] rounded-xl bg-muted/50 px-1 lg:col-span-2 border-2 border-dashed border-gray-400">
                        <ScrollArea className="relative flex h-full w-full flex-col">
                            {(Object.keys(results).length === 0) && !loading && (
                                <>  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
                                    <PreviewOutputsImageGallery viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} />
                                </div>
                                    <Badge
                                        className="absolute right-3 top-3 bg-gradient-to-r from-blue-400 to-purple-600 text-white border-transparent px-10 py-2 text-base rounded-lg"
                                    >
                                        图像显示
                                    </Badge>
                                </>
                            )}
                            {loading ? (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ">
                                    <Loader />
                                </div>
                            ) : (



                                <div className="flex-1 h-full p-4 flex overflow-y-auto">
                                    <div className="flex flex-col w-full h-full">
                                        {Object.entries(results).map(([timestamp, generation], index, array) => (
                                            <div className="flex flex-col gap-4 w-full h-full" key={timestamp}>
                                                <div className="flex flex-wrap w-full h-full gap-4" key={timestamp}>
                                                    {generation.map((output, imgIndex) => (
                                                        <Fragment key={output.url}>
                                                            <div
                                                                key={output.url}
                                                                className="flex flex-col items-center justify-center px-4 sm:w-[calc(60%-2rem)] lg:w-[calc(33.333%-2rem)] gap-4"
                                                            >
                                                                {(output.outputs.type.startsWith('image/')) && (
                                                                    <BlurFade key={output.url} delay={0.25} inView className="flex items-center justify-center w-full h-full">
                                                                        <img
                                                                            src={output.url}
                                                                            alt={`${output.url}`}
                                                                            className={cn(
                                                                                "max-w-full max-h-full w-96 h-auto object-contain rounded-md transition-all hover:scale-105",
                                                                                "mb-4" // 增加图片与按钮之间的下边距
                                                                            )}
                                                                        />
                                                                    </BlurFade>
                                                                )}
                                                                <div className="flex gap-4 w-full justify-center">
                                                                    <Button
                                                                        variant="default"
                                                                        size="icon"
                                                                        className="w-[20%] h-[70%] bg-gradient-to-r from-gray-500 to-gray-500 text-white hover:scale-105 transition-transform aspect-[4/3] font-bold"
                                                                        onClick={() => handleSaveImage(output.url, `image_${timestamp}_${imgIndex}.jpg`)}
                                                                    >
                                                                        保存
                                                                    </Button>
                                                                    <Button
                                                                        variant="default"
                                                                        size="icon"
                                                                        className="w-[20%] h-[70%] bg-gradient-to-r from-gray-500 to-gray-500 text-white hover:scale-105 transition-transform aspect-[4/3] font-bold"
                                                                        onClick={() => handleDeleteImage(timestamp, imgIndex)}
                                                                    >
                                                                        删除
                                                                    </Button>
                                                                    <Button
                                                                        variant="default"
                                                                        size="icon"
                                                                        className="w-[20%] h-[70%] bg-gradient-to-r from-gray-500 to-gray-500 text-white hover:scale-105 transition-transform aspect-[4/3] font-bold"
                                                                        onClick={() => handleSendEmail(output.url, `image_${timestamp}_${imgIndex}.jpg`)}
                                                                    >
                                                                        发送邮件
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </Fragment>
                                                    ))}
                                                </div>
                                                <hr className={
                                                    `w-full py-4 
                                                ${index !== array.length - 1 ? 'border-purple-300' : 'border-transparent'}
                                            `}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>


                            )}
                        </ScrollArea>
                    </div>
                </main>
                <ErrorAlertDialog open={errorAlertDialog.open} errorTitle={errorAlertDialog.errorTitle} errorDescription={errorAlertDialog.errorDescription} onClose={errorAlertDialog.onClose} />

            </div>
        </>
    )
}

export default function PlaygroundPage() {
    return (

        <PlaygroundPageContent />
    );
}