import { Module } from "@nestjs/common";
import { resolve } from "node:path";
import { FILE_STORAGE } from "./file-storage";
import { LocalFileStorage } from "./local-file-storage";

@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: () =>
        new LocalFileStorage(
          process.env["FILE_STORAGE_ROOT"] ?? resolve(process.cwd(), "storage", "employee-documents"),
        ),
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
