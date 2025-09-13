import { readFileSync, PathLike } from "fs";
import type { Optional } from "./types";
import path from "path";

export default class FsTools {
  public static readNcm(ncmPath: PathLike): Optional<Buffer> {
    try {
      if (path.extname(ncmPath.toString()).toLocaleLowerCase() !== '.ncm')
        throw new Error(`${ncmPath} not end with ".ncm"`);
      const data = readFileSync(ncmPath);

      return data;
    } catch (err) {
      throw err;
    }
  }
};