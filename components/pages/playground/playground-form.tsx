import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { IViewComfyBase, IViewComfyWorkflow } from "@/app/providers/view-comfy-provider";
import { cn } from "@/lib/utils";
import { ViewComfyForm } from "@/components/view-comfy/view-comfy-form";
import { WandSparkles, Camera, X } from "lucide-react";
import "./PlaygroundForm.css";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PlaygroundForm(props: {
    viewComfyJSON: IViewComfyWorkflow;
    onSubmit: (data: IViewComfyWorkflow) => void;
    loading: boolean;
}) {
    const { viewComfyJSON, onSubmit, loading } = props;
    const [email, setEmail] = useState(viewComfyJSON.email || "");
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // 摄像头相关状态和方法
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const abortControllerRef = useRef<AbortController>();
    // 表单配置
    const defaultValues = {
        title: viewComfyJSON.title,
        description: viewComfyJSON.description,
        textOutputEnabled: viewComfyJSON.textOutputEnabled ?? false,
        inputs: viewComfyJSON.inputs,
        advancedInputs: viewComfyJSON.advancedInputs,
        email: email,
        previewImages: viewComfyJSON.previewImages || []
    };

    const form = useForm<IViewComfyBase>({
        defaultValues
    });

    // 清理摄像头资源
    useEffect(() => {
        return () => {
            closeCamera();
        };
    }, []);

    // 关闭摄像头
    const closeCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
        setIsVideoReady(false);
        setCameraError(null);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // 打开摄像头准备拍照
    const openCamera = async () => {
        setCameraError(null);
        setIsVideoReady(false);
        setIsCameraOpen(true);

        try {
            // 检查浏览器是否支持getUserMedia
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("BROWSER_NOT_SUPPORTED");
            }
            // 获取用户媒体设备列表，检查是否有可用的摄像头
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (devices.filter(d => d.kind === "videoinput").length === 0) {
                throw new Error("NO_CAMERA_FOUND");
            }
            // 创建新的AbortController来控制摄像头流的中断
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 720 },
                    height: { ideal: 720 },
                    facingMode: "user"
                }
            });
            streamRef.current = stream;
            // 获取视频元素并设置其源为摄像头流
            const video = videoRef.current;
            if (!video) throw new Error("VIDEO_ELEMENT_MISSING");

            const videoReady = new Promise<void>((resolve, reject) => {
                const onCanPlay = () => {
                    video.removeEventListener("canplay", onCanPlay);
                    video.removeEventListener("error", onError);
                    resolve();
                };

                const onError = (err: ErrorEvent) => {
                    video.removeEventListener("canplay", onCanPlay);
                    video.removeEventListener("error", onError);
                    reject(err.error || new Error("VIDEO_PLAYBACK_FAILED"));
                };
                // 设置超时时间，如果5秒内视频未准备好，则触发错误
                video.addEventListener("canplay", onCanPlay, { signal });
                video.addEventListener("error", onError, { signal });
                // 如果用户中断请求（例如关闭摄像头），则触发错误
                const timeout = setTimeout(() => {
                    video.removeEventListener("canplay", onCanPlay);
                    video.removeEventListener("error", onError);
                    reject(new Error("CAMERA_TIMEOUT"));
                }, 5000);

                signal.addEventListener("abort", () => {
                    clearTimeout(timeout);
                    reject(new Error("USER_ABORTED"));
                });
            });

            video.srcObject = stream;
            await videoReady;
            await video.play();

            setIsVideoReady(true);
        } catch (error) {
            handleCameraError(error);
            closeCamera();
        }
    };

    // 统一错误处理
    const handleCameraError = (error: unknown) => {
        const errorMap: Record<string, string> = {
            "BROWSER_NOT_SUPPORTED": "当前浏览器不支持摄像头访问",
            "NO_CAMERA_FOUND": "未检测到可用摄像头",
            "NotAllowedError": "请允许摄像头权限",
            "NotFoundError": "未找到摄像头设备",
            "NotReadableError": "摄像头被其他应用占用",
            "OverconstrainedError": "无法满足摄像头配置要求",
            "CAMERA_TIMEOUT": "摄像头初始化超时",
            "USER_ABORTED": "用户取消操作",
            "VIDEO_ELEMENT_MISSING": "视频元素不存在",
            "VIDEO_PLAYBACK_FAILED": "视频播放失败"
        };

        const message = error instanceof Error ?
            errorMap[error.message] || error.message :
            "未知摄像头错误";

        setCameraError(message);
        console.error("Camera Error:", error);
    };

    // 拍照功能
    const captureImage = () => {
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            // 检查视频和画布并获取画布上下文
            if (!video || !canvas) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("无法获取画布上下文");
            // 将视频帧绘制到画布上
            ctx.drawImage(video, 0, 0);

            const imageData = canvas.toDataURL("image/jpeg");

            // 检查图片数量是否超过限制
            if (capturedImages.length + viewComfyJSON.previewImages.length >= 9) {
                alert("最多只能添加9张图片，请删除多余图片后再尝试。");
                return;
            }

            setCapturedImages(prev => {
                const newImages = [...prev, imageData];
                form.setValue("previewImages", [...viewComfyJSON.previewImages, ...newImages]);
                return newImages;
            });

            closeCamera();
        } catch (error) {
            console.error("拍照失败:", error);
            setCameraError("拍照失败，请重试");
        }
    };

    // 删除已经上传的图片
    const removeImage = (index: number) => {
        setCapturedImages(prev => {
            const newImages = prev.filter((_, i) => i !== index);
            form.setValue("previewImages", [...viewComfyJSON.previewImages, ...newImages]);
            return newImages;
        });
    };

    // 表单提交
    const handleSubmit = (data: IViewComfyBase) => {
        onSubmit({
            ...viewComfyJSON,
            ...data,
            email,
            previewImages: [...viewComfyJSON.previewImages, ...capturedImages]
        });
    };

    return (
        <div className="relative h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                <ViewComfyForm
                    form={form}
                    onSubmit={handleSubmit}
                    inputFieldArray={useFieldArray({
                        control: form.control,
                        name: "inputs"
                    })}
                    advancedFieldArray={useFieldArray({
                        control: form.control,
                        name: "advancedInputs"
                    })}
                    isLoading={loading}
                >
                    {/* 摄像头控制区域 */}
                    <div className="mt-4 space-y-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openCamera}
                            disabled={isCameraOpen}
                            className="w-full flex gap-2"
                        >
                            <Camera className="h-4 w-4" />
                            {isCameraOpen ? "正在初始化摄像头..." : "拍摄参考人脸"}
                        </Button>

                        {/* 图片预览区域 */}
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {/* 预设图片 */}
                            {viewComfyJSON.previewImages?.map((img, i) => (
                                <div key={i} className="relative group">
                                    <img
                                        src={img}
                                        alt={`预设图${i + 1}`}
                                        className="w-full h-24 object-cover rounded-md border"
                                    />
                                </div>
                            ))}
                            {/* 拍摄的图片 */}
                            {capturedImages.map((img, i) => (
                                <div key={i} className="relative group">
                                    <img
                                        src={img}
                                        alt={`拍摄图${i + 1}`}
                                        className="w-full h-24 object-cover rounded-md border"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(i)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 摄像头对话框 */}
                    <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
                        <DialogContent className="max-w-[95vw] md:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>拍摄参考照片</DialogTitle>
                            </DialogHeader>

                            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />

                                {!isVideoReady && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                                        {cameraError || "正在初始化摄像头..."}
                                    </div>
                                )}
                            </div>

                            <canvas ref={canvasRef} className="hidden" />

                            <div className="flex gap-2 justify-end">
                                <Button
                                    onClick={captureImage}
                                    disabled={!isVideoReady}
                                >
                                    拍照
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={closeCamera}
                                >
                                    取消
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </ViewComfyForm>
            </div>
            {/* 提交区域 */}

            <div className="sticky bottom-0 bg-background pt-4 border-t">
                <div className="space-y-4 p-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">邮箱</label>
                        <Input
                            type="email"
                            placeholder="请填写用于接收生成图片的邮箱"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                        onClick={form.handleSubmit(handleSubmit)}
                    >
                        {loading ? "生成中..." : "开始生成"}
                        <WandSparkles className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>

        </div>


        //     </div>
        // );
    )
}