import path from "node:path";

export function groupFilesByDirectory(files: string[]): Map<string, string[]> {
  const filesByDir = new Map<string, string[]>();

  for (const filePath of files) {
    const dirPath = path.dirname(filePath);
    const existing = filesByDir.get(dirPath);
    if (existing) {
      existing.push(filePath);
    } else {
      filesByDir.set(dirPath, [filePath]);
    }
  }

  return filesByDir;
}
