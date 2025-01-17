import { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Handle each selected file
    Array.from(files).forEach(file => {
      onFileSelect(file);
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple // Allow multiple file selection
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" // Add more file types as needed
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={handleClick}
        disabled={disabled}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    </>
  );
} 