import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 8 },
    "image/avif": { maxFileSize: "8MB", maxFileCount: 8 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 8 },
  }).onUploadComplete(async ({ file }) => {
    return { url: file.url };
  }),
  
  fileUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 8 },
    text: { maxFileSize: "16MB", maxFileCount: 8 },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 8 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 8
    },
  }).onUploadComplete(async ({ file }) => {
    return { url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
