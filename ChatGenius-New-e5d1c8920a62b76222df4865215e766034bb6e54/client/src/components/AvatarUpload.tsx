import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/lib/types";

interface AvatarUploadProps {
  user: User;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function AvatarUpload({ user, size = "md", disabled = false }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  // Size mappings for the avatar
  const sizeClasses = {
    sm: "h-20 w-20",
    md: "h-32 w-32",
    lg: "h-40 w-40"
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    // Detailed file validation
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: `Selected file is "${file.type}". Please select an image file (JPEG, PNG, GIF, etc.)`,
        variant: "destructive"
      });
      return;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: `File size is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed size is 5MB.`,
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setIsUploading(true);
      console.log('Starting upload for file:', file.name, file.type, file.size);

      // First, upload the file
      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (!response.ok) {
        // Handle specific HTTP error codes
        switch (response.status) {
          case 413:
            throw new Error("File size too large for server. Please try a smaller image.");
          case 415:
            throw new Error("File type not supported by server. Please try a different image format.");
          case 401:
            throw new Error("Please log in again to update your profile picture.");
          default:
            throw new Error(data.error || `Upload failed (HTTP ${response.status}): ${data.message || 'Unknown error'}`);
        }
      }

      // Store the new avatar URL
      const newAvatarUrl = data.avatarUrl;
      console.log('Received avatar URL:', newAvatarUrl);

      // Verify the URL format
      if (!newAvatarUrl || typeof newAvatarUrl !== 'string') {
        throw new Error('Server returned invalid avatar URL');
      }

      // Create a promise to preload the image with timeout
      const imageLoadPromise = new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          reject(new Error(`Image load timed out after 10 seconds. URL: ${newAvatarUrl}`));
        }, 10000); // 10 second timeout

        img.onload = () => {
          clearTimeout(timeout);
          console.log('Image loaded successfully:', {
            url: newAvatarUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete
          });
          resolve(true);
        };

        img.onerror = (error) => {
          clearTimeout(timeout);
          // Try to fetch the image directly to get more error details
          fetch(newAvatarUrl)
            .then(response => {
              if (!response.ok) {
                console.error('Image fetch failed:', {
                  status: response.status,
                  statusText: response.statusText,
                  url: response.url
                });
                reject(new Error(`Image fetch failed: HTTP ${response.status} - ${response.statusText}`));
              } else {
                console.error('Image fetch succeeded but image loading failed:', {
                  contentType: response.headers.get('content-type'),
                  contentLength: response.headers.get('content-length'),
                  url: response.url
                });
                reject(new Error('Image loaded as response but failed to display'));
              }
            })
            .catch(fetchError => {
              console.error('Image fetch error:', {
                error: fetchError,
                url: newAvatarUrl,
                imgError: error
              });
              reject(new Error(`Failed to fetch image: ${fetchError.message}`));
            });
        };

        // Add timestamp to bust cache
        const urlWithTimestamp = `${newAvatarUrl}?t=${Date.now()}`;
        console.log('Attempting to load image from:', urlWithTimestamp);
        img.src = urlWithTimestamp;
      });

      // Wait for both the image to load and the queries to update
      await Promise.all([
        imageLoadPromise,
        // Invalidate all queries that might have the user's avatar
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/channels"] })
      ]);

      // If we got here, the image loaded successfully
      setUploadedAvatar(newAvatarUrl);
      
      // Update all relevant caches with the new avatar URL
      const updateUserData = (oldData: any) => {
        if (!oldData) return oldData;
        console.log('Updating cache with new avatar:', newAvatarUrl);
        return {
          ...oldData,
          avatarUrl: newAvatarUrl
        };
      };

      // Update all caches that might contain the user's data
      queryClient.setQueryData(["/api/users/me"], updateUserData);
      queryClient.setQueriesData({ queryKey: ["/api/users"] }, (oldData: any) => {
        if (!oldData) return oldData;
        if (Array.isArray(oldData)) {
          return oldData.map(user => user.id === data.user?.id ? updateUserData(user) : user);
        }
        return oldData;
      });

      // Force immediate refetch of user data to ensure consistency
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/users/me"] }),
        queryClient.refetchQueries({ queryKey: ["/api/users"] })
      ]);
      
      toast({
        title: "Success",
        description: "Profile picture updated successfully"
      });
    } catch (error) {
      console.error('Detailed upload error:', error);
      setUploadedAvatar(null);
      toast({
        title: "Upload Failed",
        description: error instanceof Error 
          ? `${error.message} (Error Code: ${Date.now().toString(36)})`
          : "Failed to update profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Use the uploaded avatar if available, otherwise use the user's current avatar
  const displayUser = uploadedAvatar ? { ...user, avatarUrl: uploadedAvatar } : user;

  return (
    <div className="relative group">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      
      <div className="relative cursor-pointer" onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}>
        <UserAvatar
          user={displayUser}
          className={`${sizeClasses[size]} border-4 border-background ring-4 ring-muted`}
          interactive={false}
          forceRefresh={true}
        />
        {!disabled && (
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background"
            disabled={isUploading}
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
} 