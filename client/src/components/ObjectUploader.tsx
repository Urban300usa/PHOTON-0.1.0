import { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, File } from "lucide-react";

interface UploadedFile {
  file: File;
  url?: string;
  uploading?: boolean;
  error?: string;
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { successful: { url: string; name: string; size: number; type: string }[] }) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  allowedFileTypes,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  buttonSize = "default",
  disabled = false,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < selectedFiles.length && files.length + newFiles.length < maxNumberOfFiles; i++) {
      const file = selectedFiles[i];
      
      if (maxFileSize && file.size > maxFileSize) {
        continue;
      }
      
      if (allowedFileTypes && allowedFileTypes.length > 0) {
        const allowed = allowedFileTypes.some(type => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.includes('*')) {
            const [main] = type.split('/');
            return file.type.startsWith(main + '/');
          }
          return file.type === type;
        });
        if (!allowed) continue;
      }
      
      newFiles.push({ file });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    const successful: { url: string; name: string; size: number; type: string }[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const fileData = files[i];
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, uploading: true } : f
        ));
        
        try {
          const params = await onGetUploadParameters();
          
          const response = await fetch(params.url, {
            method: params.method,
            body: fileData.file,
            headers: {
              'Content-Type': fileData.file.type,
            },
          });
          
          if (response.ok) {
            const url = params.url.split('?')[0];
            setFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, uploading: false, url } : f
            ));
            successful.push({ 
              url, 
              name: fileData.file.name, 
              size: fileData.file.size, 
              type: fileData.file.type 
            });
          } else {
            setFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, uploading: false, error: 'Upload failed' } : f
            ));
          }
        } catch (err) {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, uploading: false, error: 'Upload failed' } : f
          ));
        }
      }
      
      if (successful.length > 0 && onComplete) {
        onComplete({ successful });
      }
      
      setShowModal(false);
      setFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const acceptTypes = allowedFileTypes?.join(',') || '*/*';

  return (
    <div>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        variant={buttonVariant}
        size={buttonSize}
        disabled={disabled}
        type="button"
        data-testid="button-upload-file"
      >
        {children}
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Upload Files</h3>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => { setShowModal(false); setFiles([]); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to select files
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max {formatFileSize(maxFileSize)} per file, up to {maxNumberOfFiles} files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={acceptTypes}
                multiple={maxNumberOfFiles > 1}
                onChange={handleFileSelect}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((fileData, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm"
                  >
                    <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{fileData.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(fileData.file.size)}
                    </span>
                    {fileData.uploading && (
                      <span className="text-xs text-primary">Uploading...</span>
                    )}
                    {fileData.error && (
                      <span className="text-xs text-destructive">{fileData.error}</span>
                    )}
                    {!fileData.uploading && !fileData.url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowModal(false); setFiles([]); }}
              >
                Cancel
              </Button>
              <Button 
                onClick={uploadFiles} 
                disabled={files.length === 0 || uploading}
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
