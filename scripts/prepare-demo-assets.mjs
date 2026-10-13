import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const files={imports:["blank-template.csv","06-30-2026.csv","smart-import.tsv"],media:["quantjournal-features.svg","quantjournal-tour.mp4","quantjournal-poster.png","quantjournal-tour.vtt","import-dialog.jpg","sample-trade.jpg"]};
for(const [folder,names] of Object.entries(files)){await mkdir(resolve(root,"demo/public",folder),{recursive:true});for(const name of names){await copyFile(resolve(root,"public",folder,name),resolve(root,"demo/public",folder,name));}}
