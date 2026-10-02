import { createVectorIndex, embed, loadModel, loadVectorIndex, unloadModel, GTE_LARGE_FP16, VectorIndexStorage } from "@qvac/sdk";

const query = process.argv[2] || "Which moon has methane rain and lakes?";
console.log(`▸ Query: "${query}"`);

const documents = new Map<string, string>([
  ["1", "Saturn moon Titan has lakes, clouds, and rain made of liquid methane."],
  ["2", "Solar panels convert sunlight into electricity using photovoltaic cells."],
  ["3", "Honeybees communicate the location of flowers through a waggle dance."],
  ["4", "The Pacific Ocean is the largest and deepest ocean on Earth."],
]);
const ids = [...documents.keys()];
const texts = [...documents.values()];

const modelId = await loadModel({ modelSrc: GTE_LARGE_FP16 });

// 1: embed the documents and add them to a new index

// 2: embed the query and print the two nearest documents

// 3: write a snapshot, load it back and search it

await unloadModel({ modelId });
