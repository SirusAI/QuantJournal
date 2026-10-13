import { readFile, writeFile } from "node:fs/promises";
const source=await readFile(new URL("../media/root.tsx",import.meta.url),"utf8");
const time=seconds=>`00:${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}.000`;
const entries=["00:00:00.000 --> 00:00:06.000\nQuantJournal: execution history, clearer reviews. Fictional data, synthetic prices, simulated AI."];
for(const match of source.matchAll(/start:(\d+),end:(\d+),title:"([^"]+)",caption:"([^"]+)"/g))entries.push(`${time(Number(match[1]))} --> ${time(Number(match[2]))}\n${match[3]}. ${match[4]}`);
entries.push("00:01:56.000 --> 00:02:00.000\nTry the sample, explore, reset and repeat. Import real broker records in your local installation.");
await writeFile(new URL("../public/media/quantjournal-tour.vtt",import.meta.url),"WEBVTT\n\n"+entries.join("\n\n")+"\n");
