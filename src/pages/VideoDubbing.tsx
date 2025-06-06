import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Play, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ServiceCostDisplay from "@/components/ServiceCostDisplay";
import CreditConfirmDialog from "@/components/CreditConfirmDialog";
import { useCredits } from "@/hooks/useCredits";
import { useVideos, type Video as VideoType } from "@/hooks/useVideos";
import { useDubbingJobs } from "@/hooks/dubbingJobs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import VideoDubbingForm from "@/components/VideoDubbingForm";
import DubbingJobsList from "@/components/DubbingJobsList";
import { submitVideoDubbing } from "@/services/api";
import { useInterval } from "@/hooks/useInterval";
import { calculateCostFromFileDuration } from "@/services/api/pricingService";

const VideoDubbing = () => {
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceCloning, setIsVoiceCloning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [videoSelectOpen, setVideoSelectOpen] = useState(false);
  const [currentForm, setCurrentForm] = useState<any>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [isCalculatingCost, setIsCalculatingCost] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const hasCleanedUpRef = useRef(false);

  const { credits, useCredits: spendCredits, hasEnoughCredits } = useCredits();
  const {
    videos,
    isLoading: isLoadingVideos,
    uploadVideo,
    deleteVideo,
  } = useVideos();
  const {
    jobs: dubbingJobs,
    isLoading: isLoadingJobs,
    createJob,
    refreshJobStatus,
    isUpdating,
  } = useDubbingJobs();

  useEffect(() => {
    if (selectedVideo) {
      loadVideoURL(selectedVideo);
    } else {
      setVideoURL(null);
      setFileDuration(null);
    }
  }, [selectedVideo]);

  const handleTabChange = (value: string) => {
    if ((value === "dub" || value === "preview") && !selectedVideo) {
      toast.error("Please select a video first");
      return;
    }

    setActiveTab(value);
  };

  useInterval(() => {
    if (
      dubbingJobs.some(
        (job) => job.status === "queued" || job.status === "running"
      )
    ) {
      console.log("Interval triggered: Refreshing active job statuses");
      refreshJobStatus();
    }
  }, 5000);

  useEffect(() => {
    if (dubbingJobs.length > 0) {
      console.log("Initial refresh of job statuses");
      refreshJobStatus();
    }
  }, [dubbingJobs.length]);

  const loadVideoURL = async (video: VideoType) => {
    try {
      if (!user || !video.video_url) return;

      // For video_clips, we already have the video_url, so we can use it directly
      setVideoURL(video.video_url);

      const videoElement = document.createElement("video");
      videoElement.src = video.video_url;

      videoElement.onloadedmetadata = () => {
        console.log(`Video duration loaded: ${videoElement.duration} seconds`);
        setFileDuration(videoElement.duration);
      };

      videoElement.onerror = () => {
        console.error("Error loading video metadata");
        toast.error("Could not determine video duration");
      };
    } catch (error) {
      console.error("Error loading video URL:", error);
      toast.error("Failed to load video");
    }
  };

  useEffect(() => {
    const updateCost = async () => {
      if (!fileDuration || !currentForm) {
        return;
      }

      setIsCalculatingCost(true);

      try {
        const enableLipSync = currentForm.enable_lipsyncing || false;
        const languages = currentForm.target_languages || [];

        const cost = await calculateCostFromFileDuration(
          fileDuration,
          "dubbing",
          {
            enableLipSync,
            languages,
          }
        );

        console.log(
          `Dubbing cost calculation: ${fileDuration / 60} minutes with ${
            languages.length
          } languages, lip sync: ${enableLipSync} = ${cost} credits`
        );
        setTotalCost(cost);
      } catch (error) {
        console.error("Error calculating dubbing cost:", error);
      } finally {
        setIsCalculatingCost(false);
      }
    };

    updateCost();
  }, [fileDuration, currentForm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      setIsUploading(true);

      let uploadProgress = 0;
      const progressInterval = setInterval(() => {
        uploadProgress += 5;
        setProgress(uploadProgress);

        if (uploadProgress >= 95) {
          clearInterval(progressInterval);
        }
      }, 300);

      const fileNameWithoutExt = file.name.split(".").slice(0, -1).join(".");

      uploadVideo.mutate({
        title: fileNameWithoutExt,
        prompt: fileNameWithoutExt,
        file: file  // Pass the actual file instead of blob URL
      }, {
        onSuccess: (newVideo) => {
          setProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            setProgress(0);
            setSelectedVideo(newVideo as VideoType);
            setUploadDialogOpen(false);
          }, 500);
        },
        onError: () => {
          clearInterval(progressInterval);
          setIsUploading(false);
          setProgress(0);
        },
      });
    }
  };

  const handleProcessVideo = (formValues: any) => {
    if (!selectedVideo) {
      toast.error("Please select a video first.");
      return;
    }

    if (
      !formValues.target_languages ||
      formValues.target_languages.length === 0
    ) {
      toast.error("Please select at least one language for dubbing.");
      return;
    }

    setCurrentForm(formValues);
    setShowCreditConfirm(true);
  };

  const confirmAndProcess = async () => {
    if (!videoURL || !currentForm || !selectedVideo) return;

    setIsProcessing(true);
    let creditTransaction = null;

    try {
      // First deduct the credits
      creditTransaction = await spendCredits.mutateAsync({
        amount: totalCost,
        service: "Video Dubbing",
        description: `Dubbed video in ${
          currentForm.target_languages.length
        } languages, ${
          isVoiceCloning ? "with voice cloning" : "with AI voice"
        }`,
      });

      const languages = currentForm.target_languages.join(",");

      console.log("Submitting dubbing job with languages:", languages);
      const response = await submitVideoDubbing(videoURL, {
        target_language: languages,
        enable_voice_cloning: currentForm.enable_voice_cloning,
        preserve_background_audio: currentForm.preserve_background_audio,
        enable_lipsyncing: currentForm.enable_lipsyncing,
        safewords: currentForm.safewords,
        translation_dictionary: currentForm.translation_dictionary || "",
        start_time: currentForm.start_time,
        end_time: currentForm.end_time,
      });

      console.log(
        "Dubbing job submitted successfully, Sieve job ID:",
        response.id
      );

      const newJob = await createJob.mutateAsync({
        sieve_job_id: response.id,
        status: response.status,
        languages: currentForm.target_languages,
      });

      // Record the credit transaction
      await supabase.from("credit_transactions").insert({
        user_id: user?.id,
        amount: totalCost,
        type: "usage",
        service: "Video Dubbing",
        description: `Dubbed video in ${
          currentForm.target_languages.length
        } languages, ${
          isVoiceCloning ? "with voice cloning" : "with AI voice"
        }`,
        status: "completed",
      });

      console.log("Job created in database:", newJob);

      toast.success(`Dubbing job submitted successfully!`);
      setTimeout(() => {
        console.log("Initial status check after job creation");
        refreshJobStatus();
        setActiveTab("preview");
      }, 1000);
    } catch (error) {
      console.error("Error in dubbing process:", error);

      // If credits were deducted and there was an error, refund them
      if (creditTransaction) {
        try {
          await spendCredits.mutateAsync({
            amount: -totalCost, // Negative amount for refund
            service: "Video Dubbing Refund",
            description: `Refund for failed dubbing job: ${
              error.message || "Unknown error"
            }`,
          });
          toast.info("Credits have been refunded due to the error");
        } catch (refundError) {
          console.error("Error refunding credits:", refundError);
          toast.error("Error processing refund. Please contact support.");
        }
      }

      toast.error(`Failed to process: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteVideo = (video: VideoType) => {
    if (window.confirm(`Are you sure you want to delete "${video.title}"?`)) {
      deleteVideo.mutate(video.id, {
        onSuccess: () => {
          if (selectedVideo?.id === video.id) {
            setSelectedVideo(null);
          }
        },
      });
    }
  };

  const goToNextStep = () => {
    if (activeTab === "upload" && selectedVideo) {
      setActiveTab("dub");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Video Dubbing
        </h1>
        <p className="text-muted-foreground">
          Convert your videos into multiple languages with AI-powered voice
          cloning.
        </p>
      </div>

      <CreditConfirmDialog
        open={showCreditConfirm}
        setOpen={setShowCreditConfirm}
        serviceName="Video Dubbing"
        creditCost={totalCost}
        onConfirm={confirmAndProcess}
        description={`This will use ${totalCost} credits to dub your video in ${
          currentForm?.target_languages?.length || 0
        } languages ${
          currentForm?.enable_voice_cloning
            ? "with voice cloning"
            : "with AI voice"
        }.`}
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="upload">Select Video</TabsTrigger>
          <TabsTrigger value="dub">Dub</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Video</CardTitle>
              <CardDescription>
                Select a video to dub or upload a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedVideo ? (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    {videoURL ? (
                      <video
                        src={videoURL}
                        className="w-full h-full object-contain"
                        controls
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Play className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">
                      {selectedVideo.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Duration: {selectedVideo.duration}s
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Uploaded:{" "}
                      {new Date(selectedVideo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center py-8">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">No video selected</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please select a video from your library or upload a new
                      one
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Dialog
                      open={videoSelectOpen}
                      onOpenChange={setVideoSelectOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">Select from Library</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Your Videos</DialogTitle>
                          <DialogDescription>
                            Select a video from your library to dub
                          </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                          {isLoadingVideos ? (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground">
                                Loading your videos...
                              </p>
                            </div>
                          ) : videos && videos.length > 0 ? (
                            <div className="space-y-4">
                              {videos.map((video) => (
                                <div
                                  key={video.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                  onClick={() => {
                                    setSelectedVideo(video);
                                    setVideoSelectOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                      <Video className="h-5 w-5 text-gray-500" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {video.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(
                                          video.created_at
                                        ).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteVideo(video);
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="24"
                                      height="24"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="lucide lucide-trash-2 h-4 w-4 text-muted-foreground hover:text-red-500"
                                    >
                                      <path d="M3 6h18"></path>
                                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                      <line
                                        x1="10"
                                        x2="10"
                                        y1="11"
                                        y2="17"
                                      ></line>
                                      <line
                                        x1="14"
                                        x2="14"
                                        y1="11"
                                        y2="17"
                                      ></line>
                                    </svg>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground">
                                No videos found in your library
                              </p>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setVideoSelectOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              setVideoSelectOpen(false);
                              setUploadDialogOpen(true);
                            }}
                          >
                            Upload New
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={uploadDialogOpen}
                      onOpenChange={setUploadDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button className="bg-youtube-red hover:bg-youtube-darkred">
                          Upload New Video
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload New Video</DialogTitle>
                          <DialogDescription>
                            Upload a video to get started with dubbing
                          </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                          <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
                            {isUploading ? (
                              <div className="space-y-4">
                                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <span className="animate-spin">⟳</span>
                                </div>
                                <div>
                                  <p className="font-medium">
                                    Uploading video...
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {progress}% complete
                                  </p>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className="bg-youtube-red h-2.5 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Upload className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    Drag and drop or click to upload
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Supports MP4, MOV, AVI up to 500MB
                                  </p>
                                </div>
                                <Input
                                  id="video-upload"
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={handleFileChange}
                                />
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    document
                                      .getElementById("video-upload")
                                      ?.click()
                                  }
                                >
                                  Select Video
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setUploadDialogOpen(false)}
                            disabled={isUploading}
                          >
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setSelectedVideo(null)}
                disabled={!selectedVideo}
              >
                Deselect
              </Button>
              <Button
                variant="default"
                disabled={!selectedVideo}
                className="bg-youtube-red hover:bg-youtube-darkred"
                onClick={goToNextStep}
              >
                Next Step
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="dub" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dubbing Settings</CardTitle>
              <CardDescription>
                Configure languages and voice settings for your video
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedVideo ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium">No video selected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a video from the "Select Video" tab first
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab("upload")}
                  >
                    Go to Select Video
                  </Button>
                </div>
              ) : (
                <VideoDubbingForm
                  onSubmit={handleProcessVideo}
                  isProcessing={isProcessing}
                  isVoiceCloning={isVoiceCloning}
                  setIsVoiceCloning={setIsVoiceCloning}
                  cost={totalCost}
                  fileDuration={fileDuration || undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview Dubbed Videos</CardTitle>
              <CardDescription>
                View and download your dubbed videos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DubbingJobsList
                jobs={dubbingJobs}
                onRefresh={refreshJobStatus}
                isLoading={isLoadingJobs || isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VideoDubbing;
