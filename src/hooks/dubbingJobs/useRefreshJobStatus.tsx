import { useState } from 'react';
import { checkDubbingJobStatus } from '@/services/api';
import { useUpdateDubbingJob } from './useUpdateDubbingJob';
import { DubbingJob } from './types';
import { toast } from 'sonner';
import { SieveDubbingResponse } from '@/services/api/types';
import { downloadAndStoreDubbedVideo } from '@/services/videoClipsService';

export const useRefreshJobStatus = (jobs: DubbingJob[], refetch: () => void) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { updateJob } = useUpdateDubbingJob();

  const refreshJobStatus = async () => {
    if (!jobs || isUpdating) return;
    
    setIsUpdating(true);
    console.log("Starting refresh of job statuses");
    
    try {
      // First, check if there are any jobs with output URLs that aren't marked succeeded
      const jobsWithUrlNotSucceeded = jobs.filter(job => 
        job.output_url && job.status !== "succeeded"
      );
      
      if (jobsWithUrlNotSucceeded.length > 0) {
        console.log(`Found ${jobsWithUrlNotSucceeded.length} jobs with URLs that aren't marked succeeded`);
        
        for (const job of jobsWithUrlNotSucceeded) {
          await updateJob.mutateAsync({
            id: job.id,
            status: "succeeded",
            output_url: job.output_url,
            error: null
          });
        }
      }
      
      // Then check for active jobs (queued or running)
      const activeJobs = jobs.filter(job => 
        (job.status === "queued" || job.status === "running") && !job.output_url
      );
      
      if (activeJobs.length === 0) {
        console.log("No active jobs to refresh");
        setIsUpdating(false);
        return;
      }
      
      console.log(`Refreshing statuses for ${activeJobs.length} active jobs`);
      
      // Process each active job
      const updatedJobs = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            console.log(`Checking status for job ${job.sieve_job_id}`);
            const response: SieveDubbingResponse = await checkDubbingJobStatus(job.sieve_job_id);
            console.log(`Job ${job.sieve_job_id} API status:`, response.status, 
              "Output URL:", response.outputs?.output_0?.url);
            
            // If the job has an output URL, download and store it, then mark as succeeded
            if (response.outputs?.output_0?.url) {
              console.log(`Job ${job.sieve_job_id} has output URL, downloading and storing...`);
              
              try {
                // Download and store the video in Supabase
                const storedUrl = await downloadAndStoreDubbedVideo(
                  response.outputs.output_0.url, 
                  `dubbed_video_${job.languages.join('_')}.mp4`
                );
                
                console.log(`Video stored successfully for job ${job.sieve_job_id}:`, storedUrl);
                
                return updateJob.mutateAsync({
                  id: job.id,
                  status: "succeeded",
                  output_url: storedUrl,
                  error: null
                });
              } catch (downloadError) {
                console.error(`Failed to download video for job ${job.sieve_job_id}:`, downloadError);
                // Fallback to original URL if download fails
                return updateJob.mutateAsync({
                  id: job.id,
                  status: "succeeded",
                  output_url: response.outputs.output_0.url,
                  error: null
                });
              }
            }
            
            // If the job has failed or has an error, mark it as failed
            if (response.status === "failed" || response.error?.message) {
              console.log(`Job ${job.sieve_job_id} has failed:`, response.error?.message);
              return updateJob.mutateAsync({
                id: job.id,
                status: "failed",
                error: response.error?.message || "Failed to process the video"
              });
            }
            
            // If the status has changed, update it
            if (response.status !== job.status) {
              console.log(`Job ${job.sieve_job_id} status changed from ${job.status} to ${response.status}`);
              
              // Map API statuses to our app statuses using type-safe approach
              let newStatus: "queued" | "running" | "succeeded" | "failed" = job.status as "queued" | "running" | "succeeded" | "failed";
              
              // Convert API statuses to our app's allowed status values
              // Use string comparison instead of type comparison
              const statusStr = response.status as string;
              
              if (statusStr === "processing") {
                newStatus = "running";
              } 
              else if (statusStr === "finished") {
                newStatus = "succeeded";
              }
              else if (statusStr === "queued" || 
                       statusStr === "running" || 
                       statusStr === "succeeded" || 
                       statusStr === "failed") {
                newStatus = statusStr as "queued" | "running" | "succeeded" | "failed";
              }
              
              return updateJob.mutateAsync({
                id: job.id,
                status: newStatus,
                error: null
              });
            }
            
            // If nothing has changed, return the job as is
            return job;
          } catch (error) {
            console.error(`Error checking job status for ${job.sieve_job_id}:`, error);
            return job;
          }
        })
      );
      
      // If any jobs were updated, refresh the list
      if (updatedJobs.some(job => job !== jobs.find(j => j.id === job.id))) {
        console.log("Some jobs were updated, refreshing job list");
        refetch();
      }
    } catch (error) {
      console.error('Error refreshing job statuses:', error);
      toast.error('Failed to refresh job statuses');
    } finally {
      setIsUpdating(false);
    }
  };

  return { refreshJobStatus, isUpdating };
};
