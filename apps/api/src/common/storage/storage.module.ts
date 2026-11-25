import { Module } from "@nestjs/common";
import { resolve } from "node:path";
import { FILE_STORAGE } from "./file-storage";
import { LocalFileStorage } from "./local-file-storage";

export const LEAVE_FILE_STORAGE = Symbol("LEAVE_FILE_STORAGE");

@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: () =>
        new LocalFileStorage(
          process.env["FILE_STORAGE_ROOT"] ?? resolve(process.cwd(), "storage", "employee-documents"),
        ),
    },
    {
      provide: LEAVE_FILE_STORAGE,
      useFactory: () =>
        new LocalFileStorage(
          process.env["LEAVE_FILE_STORAGE_ROOT"] ??
            resolve(process.cwd(), "storage", "leave-attachments"),
        ),
    },
  ],
  exports: [FILE_STORAGE, LEAVE_FILE_STORAGE],
})
export class StorageModule {}
