export interface MemoryPhotoDTO {
  id: string;
  url: string;
  caption: string | null;
  placeId: string | null;
  uploadedBy: {
    userId: string;
    name: string;
  };
  createdAt: string;
}

export interface UploadMemoryInput {
  caption?: string | null;
  placeId?: string | null;
}
