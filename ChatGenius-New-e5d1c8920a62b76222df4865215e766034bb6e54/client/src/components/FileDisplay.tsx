import { FileIcon, Download } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";
import { useState } from "react";
import { Button } from "./ui/button";

interface FileDisplayProps {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileDisplay({ fileUrl, fileName, fileSize, fileType }: FileDisplayProps) {
  const [showFullImage, setShowFullImage] = useState(false);

  const handleImageDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (fileType?.startsWith('image/')) {
    return (
      <div className="mt-2">
        <img
          src={fileUrl}
          alt={fileName}
          className="max-w-[300px] max-h-[300px] rounded-lg cursor-pointer object-contain hover:opacity-90"
          onClick={() => setShowFullImage(true)}
        />
        
        <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none">
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleImageDownload}
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  return (
    <a
      href={fileUrl}
      download={fileName}
      className="inline-flex items-center gap-2 p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors mt-2"
    >
      <FileIcon className="h-4 w-4" />
      <span className="text-sm">{fileName}</span>
      <span className="text-xs text-white/50">
        ({formatFileSize(fileSize)})
      </span>
    </a>
  );
} 